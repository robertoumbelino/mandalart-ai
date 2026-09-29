import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'

export const runtime = 'nodejs'

export async function GET() {
  const sessionId = await getPreviewSession()
  const [row] = await getDb()`SELECT l.id,l.answers,l.attribution,p.id AS preview_id,p.preview,p.checked
    FROM onboarding_leads l JOIN onboarding_previews p ON p.id=l.preview_id
    WHERE l.session_id=${sessionId}::uuid AND p.status='ready' AND p.expires_at>now()
      AND l.purchased_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM dream_orders o WHERE o.preview_id=p.id AND o.paid=true)
    ORDER BY l.created_at DESC LIMIT 1`
  if (!row) return Response.json({ status: 'missing' }, { headers: { 'Cache-Control': 'private, no-store' } })
  return Response.json({ status: 'ready', leadId: row.id, answers: row.answers, attribution: row.attribution, id: row.preview_id, preview: row.preview, checked: row.checked }, { headers: { 'Cache-Control': 'private, no-store' } })
}
