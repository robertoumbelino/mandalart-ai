'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_KEY,
  captureProductEvent,
  startPostHog,
} from '@/lib/posthog'

export function PostHogAnalytics() {
  const pathname = usePathname()
  const [accepted, setAccepted] = useState(false)
  const previousPage = useRef<string | null>(null)

  useEffect(() => {
    const readConsent = () => {
      try {
        setAccepted(localStorage.getItem(ANALYTICS_CONSENT_KEY) === 'accepted')
      } catch {
        setAccepted(false)
      }
    }
    readConsent()
    window.addEventListener(ANALYTICS_CONSENT_EVENT, readConsent)
    return () => window.removeEventListener(ANALYTICS_CONSENT_EVENT, readConsent)
  }, [])

  useEffect(() => {
    if (!accepted || !startPostHog()) return
    const page = `${window.location.origin}${pathname}`
    if (previousPage.current === page) return
    captureProductEvent('$pageview', {
      $current_url: page,
      $pathname: pathname,
      $referrer: previousPage.current || document.referrer.split(/[?#]/, 1)[0],
    })
    previousPage.current = page
  }, [accepted, pathname])

  return null
}
