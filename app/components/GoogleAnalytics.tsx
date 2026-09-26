'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

const MEASUREMENT_ID = 'G-P74HBXF5J7'
const PRODUCTION_HOSTS = new Set(['mandalart.com.br', 'www.mandalart.com.br'])
const pendingEvents: Array<[string, Record<string, string | number> | undefined]> = []

declare global {
  interface Window {
    dataLayer?: unknown[][]
    gtag?: (...args: unknown[]) => void
    mandalartGaConfigured?: boolean
  }
}

export function sendGoogleAnalyticsEvent(
  name: string,
  properties?: Record<string, string | number>
) {
  if (!PRODUCTION_HOSTS.has(window.location.hostname)) return
  if (window.mandalartGaConfigured) {
    window.gtag?.('event', name, properties)
  } else {
    pendingEvents.push([name, properties])
  }
}

export function GoogleAnalytics() {
  const pathname = usePathname()
  const previousPage = useRef<string | null>(null)

  useEffect(() => {
    if (!PRODUCTION_HOSTS.has(window.location.hostname)) return

    const pageLocation = `${window.location.origin}${pathname}`
    let pageReferrer = previousPage.current ?? undefined
    if (!pageReferrer && document.referrer) {
      try {
        pageReferrer = new URL(document.referrer).origin
      } catch {
        pageReferrer = undefined
      }
    }

    window.dataLayer ??= []
    window.gtag ??= (...args: unknown[]) => {
      window.dataLayer?.push(args)
    }

    if (!window.mandalartGaConfigured) {
      window.gtag('js', new Date())
      window.gtag('config', MEASUREMENT_ID, {
        send_page_view: false,
        page_location: pageLocation,
        page_referrer: pageReferrer,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
      })
      window.mandalartGaConfigured = true
    } else {
      window.gtag('set', { page_location: pageLocation, page_referrer: pageReferrer })
    }
    window.gtag('event', 'page_view', {
      page_location: pageLocation,
      page_path: pathname,
      page_referrer: pageReferrer,
      page_title: document.title,
    })
    previousPage.current = pageLocation
    for (const [name, properties] of pendingEvents.splice(0)) {
      window.gtag('event', name, properties)
    }

    if (!document.getElementById('mandalart-google-analytics')) {
      const script = document.createElement('script')
      script.id = 'mandalart-google-analytics'
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
      document.head.appendChild(script)
    }
  }, [pathname])

  return null
}
