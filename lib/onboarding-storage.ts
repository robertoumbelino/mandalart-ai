import { DRAFT_STORAGE_KEY } from '@/lib/onboarding'

export const PURCHASED_PREVIEWS_KEY = 'mandalart.begin.purchased'
const LEAD_KEY = 'mandalart.lead_id'

export function purchasedPreview(previewId: string | undefined): boolean {
  if (!previewId) return false
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(PURCHASED_PREVIEWS_KEY) || '[]')
    return Array.isArray(ids) && ids.includes(previewId)
  } catch { return false }
}

export function clearOnboardingDraft() {
  try { localStorage.removeItem(DRAFT_STORAGE_KEY) } catch {}
  try { sessionStorage.removeItem(LEAD_KEY) } catch {}
}

export function markOnboardingPurchased(previewId: string) {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PURCHASED_PREVIEWS_KEY) || '[]')
    const ids = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []
    if (!ids.includes(previewId)) localStorage.setItem(PURCHASED_PREVIEWS_KEY, JSON.stringify([...ids, previewId].slice(-100)))
    const draft = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || 'null')
    // A checkout completed in another tab must not erase a different, newer dream.
    if (draft?.result?.id === previewId) clearOnboardingDraft()
  } catch { /* Storage may be disabled; the paid plan remains saved on the server. */ }
}
