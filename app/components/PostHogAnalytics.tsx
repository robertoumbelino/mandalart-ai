'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { captureProductEvent } from '@/lib/posthog'

export function PostHogAnalytics() {
  const pathname = usePathname()
  const previousPage = useRef<string | null>(null)

  useEffect(() => {
    const page = `${window.location.origin}${pathname}`
    if (previousPage.current === page) return
    if (!captureProductEvent('$pageview', {
      $current_url: page,
      $pathname: pathname,
      $referrer: previousPage.current || document.referrer.split(/[?#]/, 1)[0],
    })) return
    previousPage.current = page
  }, [pathname])

  return null
}
