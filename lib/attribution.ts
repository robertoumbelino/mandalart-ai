import { ATTRIBUTION_KEYS } from '@/lib/onboarding'

export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>

const STORAGE_KEY = 'mandalart.attribution.v1'
const MAX_AGE = 30 * 24 * 60 * 60 * 1000

export function cleanAttribution(value: unknown): Attribution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    ATTRIBUTION_KEYS.flatMap((key) => {
      const entry = record[key]
      if (typeof entry !== 'string' || entry.length > 150) return []
      const trimmed = entry.trim()
      return trimmed ? [[key, trimmed]] : []
    }),
  ) as Attribution
}

export function captureAttribution(): Attribution {
  if (typeof window === 'undefined') return {}
  let saved: Attribution = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const entry = JSON.parse(raw) as { savedAt: number; values: unknown }
      if (Date.now() - entry.savedAt < MAX_AGE)
        saved = cleanAttribution(entry.values)
    }
  } catch {
    // The current URL can still be attributed when storage is unavailable.
  }

  const params = new URLSearchParams(window.location.search)
  const incoming = cleanAttribution(
    Object.fromEntries(ATTRIBUTION_KEYS.map((key) => [key, params.get(key)?.slice(0, 150)])),
  )
  const values = { ...saved, ...incoming }
  if (Object.keys(incoming).length) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), values }))
    } catch {
      // The order still receives values present in the URL.
    }
  }
  return values
}
