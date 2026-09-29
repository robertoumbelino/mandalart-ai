import { z } from 'zod'
import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'
import { previewProgressSchema } from '@/lib/preview-progress'
import { isSameOrigin } from '@/lib/request-origin'

const schema = z.object({ previewId: z.uuid(), checked: previewProgressSchema })
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 })
  const body = await request.text()
  if (body.length > 1000) return new Response(null, { status: 413 })
  const parsed = schema.safeParse(await Promise.resolve().then(() => JSON.parse(body || 'null')).catch(() => null))
  if (!parsed.success) return new Response(null, { status: 400 })
  const sessionId = await getPreviewSession()
  const [row] = await getDb()`UPDATE onboarding_previews SET checked=${JSON.stringify(parsed.data.checked)}::jsonb
    WHERE id=${parsed.data.previewId}::uuid AND session_id=${sessionId}::uuid
      AND status='ready' AND expires_at>now() RETURNING id`
  return new Response(null, { status: row ? 204 : 404 })
}
