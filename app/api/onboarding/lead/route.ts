import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'
import { answersSchema } from '@/lib/onboarding'
import { cleanAttribution } from '@/lib/attribution'

export const runtime = 'nodejs'

const schema = z.object({ email: z.email().max(254), answers: answersSchema, attribution: z.record(z.string(), z.unknown()).optional(), marketingConsent: z.boolean().optional() })

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Origem inválida.' }, { status: 403 })
  if (Number(request.headers.get('content-length') || 0) > 10_000) return new Response(null, { status: 413 })
  try {
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ error: 'Confira o e-mail e suas respostas.' }, { status: 400 })
    const sessionId = await getPreviewSession()
    const email = parsed.data.email.trim().toLowerCase()
    const sql = getDb()
    const [limit] = await sql`SELECT count(*)::int AS n FROM onboarding_leads WHERE session_id=${sessionId}::uuid AND created_at>now()-interval '1 hour'`
    if (Number(limit.n) >= 10) return Response.json({ error: 'Muitas tentativas. Aguarde um pouco.' }, { status: 429 })
    const attribution = cleanAttribution(parsed.data.attribution)
    const [lead] = await sql`INSERT INTO onboarding_leads(session_id,email,answers,attribution,marketing_consent)
      VALUES(${sessionId}::uuid,${email},${JSON.stringify(parsed.data.answers)}::jsonb,${JSON.stringify(attribution)}::jsonb,${parsed.data.marketingConsent === true})
      RETURNING id`
    await sql`INSERT INTO onboarding_events(session_id,lead_id,name,attribution)
      VALUES(${sessionId}::uuid,${lead.id}::uuid,'email_captured',${JSON.stringify(attribution)}::jsonb)`
    return Response.json({ id: String(lead.id) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return Response.json({ error: 'Não foi possível guardar seu e-mail. Tente novamente.' }, { status: 503 })
  }
}
