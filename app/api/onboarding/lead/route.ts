import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'
import { answersSchema } from '@/lib/onboarding'
import { cleanAttribution } from '@/lib/attribution'
import { sendPreviewAndScheduleRecovery } from '@/lib/transactional-email'

export const runtime = 'nodejs'

const schema = z.object({ email: z.email().max(254), previewId: z.uuid(), answers: answersSchema, attribution: z.record(z.string(), z.unknown()).optional(), marketingConsent: z.boolean().optional() })

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Origem inválida.' }, { status: 403 })
  if (Number(request.headers.get('content-length') || 0) > 10_000) return new Response(null, { status: 413 })
  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ error: 'Confira o e-mail e suas respostas.' }, { status: 400 })
    const sessionId = await getPreviewSession()
    const email = parsed.data.email.trim().toLowerCase()
    const sql = getDb()
    const [preview] = await sql`SELECT id FROM onboarding_previews
      WHERE id=${parsed.data.previewId}::uuid AND session_id=${sessionId}::uuid
        AND status='ready' AND expires_at>now() AND answers=${JSON.stringify(parsed.data.answers)}::jsonb`
    if (!preview) return Response.json({ error: 'Esta prévia expirou. Gere uma nova antes de salvar.' }, { status: 404 })
    const attribution = cleanAttribution(parsed.data.attribution)
    let [lead] = await sql`SELECT id FROM onboarding_leads
      WHERE session_id=${sessionId}::uuid AND preview_id=${parsed.data.previewId}::uuid AND email=${email}
      ORDER BY created_at DESC LIMIT 1`
    if (!lead) {
      const [limit] = await sql`SELECT count(*)::int AS n FROM onboarding_leads WHERE session_id=${sessionId}::uuid AND created_at>now()-interval '1 hour'`
      if (Number(limit.n) >= 10) return Response.json({ error: 'Muitas tentativas. Aguarde um pouco.' }, { status: 429 })
      const [created] = await sql`INSERT INTO onboarding_leads(session_id,email,answers,attribution,marketing_consent,preview_id,preview_viewed_at)
        VALUES(${sessionId}::uuid,${email},${JSON.stringify(parsed.data.answers)}::jsonb,${JSON.stringify(attribution)}::jsonb,${parsed.data.marketingConsent === true},${parsed.data.previewId}::uuid,now())
        RETURNING id`
      lead = created
      await sql`INSERT INTO onboarding_events(session_id,lead_id,name,attribution)
        VALUES(${sessionId}::uuid,${lead.id}::uuid,'email_captured',${JSON.stringify(attribution)}::jsonb)`
    }
    try { await sendPreviewAndScheduleRecovery(String(lead.id)) }
    catch { console.error('preview_email_schedule_failed', { leadId: String(lead.id) }) }
    const [delivery] = await sql`SELECT preview_email_sent_at FROM onboarding_leads WHERE id=${lead.id}::uuid`
    if (!delivery?.preview_email_sent_at) return Response.json({ error: 'Ainda não conseguimos enviar a prévia. Tente novamente em alguns instantes.' }, { status: 503 })
    return Response.json({ id: String(lead.id) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return Response.json({ error: 'Não foi possível guardar seu e-mail. Tente novamente.' }, { status: 503 })
  }
}
