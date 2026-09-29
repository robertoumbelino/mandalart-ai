import 'server-only'
import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'
import { answersSchema, getDream, previewSchema } from '@/lib/onboarding'
import { previewProgress } from '@/lib/preview-progress'
import { idSchema } from '@/lib/validation'

export async function loadPaidPreview(rawId: string, goal: string, userId: string) {
  const id = idSchema.parse(rawId)
  const sessionId = await getPreviewSession()
  const [row] =
    await getDb()`SELECT answers,preview,checked FROM onboarding_previews p WHERE p.id=${id}::uuid AND p.status='ready'
      AND ((p.session_id=${sessionId}::uuid AND p.expires_at>now()) OR EXISTS (
        SELECT 1 FROM dream_orders o WHERE o.preview_id=p.id AND o.user_id=${userId}::uuid AND o.paid=true
      ))`
  if (!row || getDream(answersSchema.parse(row.answers)) !== goal) {
    throw new Error('Prévia indisponível para este sonho.')
  }
  return { ...previewSchema.parse(row.preview), checked: previewProgress(row.checked) }
}
