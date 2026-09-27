'use client'

import { ANALYTICS_CONSENT_KEY } from '@/lib/posthog'

export function MarketingPreferenceButton() {
  return (
    <button
      type="button"
      className="mt-3 rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      onClick={() => {
        try { localStorage.removeItem(ANALYTICS_CONSENT_KEY) } catch {}
        window.location.reload()
      }}
    >
      Alterar preferência de medição e gravação
    </button>
  )
}
