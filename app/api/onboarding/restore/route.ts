import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'

export const runtime = 'nodejs'

export async function GET() {
  const sessionId = await getPreviewSession()
  const [row] = await getDb()`SELECT l.id,l.answers,l.attribution,p.id AS preview_id,p.preview
    FROM onboarding_leads l JOIN onboarding_previews p ON p.id=l.preview_id
    WHERE l.session_id=${sessionId}::uuid AND p.status='ready'
    ORDER BY l.created_at DESC LIMIT 1`
  if (!row) return Response.json({ status: 'missing' }, { headers: { 'Cache-Control': 'private, no-store' } })
  return Response.json({ status: 'ready', leadId: row.id, answers: row.answers, attribution: row.attribution, id: row.preview_id, preview: row.preview }, { headers: { 'Cache-Control': 'private, no-store' } })
}
