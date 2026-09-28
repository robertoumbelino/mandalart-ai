import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'
import { cleanAttribution } from '@/lib/attribution'
import { sendPreviewAndScheduleRecovery } from '@/lib/transactional-email'

export const runtime = 'nodejs'

const names = z.enum(['landing_view','quiz_started','quiz_question','quiz_completed','preview_viewed','unlock_clicked'])
const schema = z.object({ name: names, leadId: z.uuid().optional(), properties: z.record(z.string(), z.union([z.string(),z.number(),z.boolean()])).optional(), attribution: z.record(z.string(),z.unknown()).optional() })

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return new Response(null, { status: 403 })
  if (Number(request.headers.get('content-length') || 0) > 4000) return new Response(null, { status: 413 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return new Response(null, { status: 400 })
  const sessionId = await getPreviewSession()
  const sql = getDb()
  const leadId = parsed.data.leadId
  if (leadId) {
    const [lead] = await sql`SELECT id FROM onboarding_leads WHERE id=${leadId}::uuid AND session_id=${sessionId}::uuid`
    if (!lead) return new Response(null, { status: 403 })
  }
  const attribution = cleanAttribution(parsed.data.attribution)
  await sql`INSERT INTO onboarding_events(session_id,lead_id,name,properties,attribution)
    VALUES(${sessionId}::uuid,${leadId || null}::uuid,${parsed.data.name},${JSON.stringify(parsed.data.properties || {})}::jsonb,${JSON.stringify(attribution)}::jsonb)`
  if (parsed.data.name === 'preview_viewed' && leadId) {
    await sql`UPDATE onboarding_leads SET preview_viewed_at=COALESCE(preview_viewed_at,now()) WHERE id=${leadId}::uuid`
    try { await sendPreviewAndScheduleRecovery(leadId) }
    catch { console.error('preview_email_schedule_failed', { leadId }) }
  }
  return new Response(null, { status: 204 })
}
