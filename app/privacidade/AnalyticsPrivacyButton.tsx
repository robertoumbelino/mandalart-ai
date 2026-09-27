'use client'

import { useEffect, useState } from 'react'
import { POSTHOG_OPTOUT_KEY, resumePostHog, stopPostHog } from '@/lib/posthog'

export function AnalyticsPrivacyButton() {
  const [optedOut, setOptedOut] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setOptedOut(localStorage.getItem(POSTHOG_OPTOUT_KEY) === 'true') } catch {}
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <button
      type="button"
      className="mt-3 rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
      onClick={() => {
        if (optedOut) resumePostHog()
        else stopPostHog()
        setOptedOut(!optedOut)
      }}
    >
      {optedOut ? 'Reativar análise de uso neste navegador' : 'Desativar análise de uso neste navegador'}
    </button>
  )
}
