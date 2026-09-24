import 'server-only'
import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'
import { answersSchema, getDream, previewSchema } from '@/lib/onboarding'
import { idSchema } from '@/lib/validation'

export async function loadPaidPreview(rawId: string, goal: string) {
  const id = idSchema.parse(rawId)
  const sessionId = await getPreviewSession()
  const [row] =
    await getDb()`SELECT answers,preview FROM onboarding_previews WHERE id=${id}::uuid AND session_id=${sessionId}::uuid AND status='ready' AND expires_at>now()`
  if (!row || getDream(answersSchema.parse(row.answers)) !== goal) {
    throw new Error('Prévia indisponível para este sonho.')
  }
  return previewSchema.parse(row.preview)
}
