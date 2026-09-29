'use client'

import { useEffect, useRef } from 'react'
import { captureAttribution } from '@/lib/attribution'
import { usePathname } from 'next/navigation'

const MEASUREMENT_ID = 'G-P74HBXF5J7'
const PRODUCTION_HOSTS = new Set(['mandalart.com.br', 'www.mandalart.com.br'])
type EventProperties = Record<string, string | number | Array<Record<string, string | number>>>
const pendingEvents: Array<[string, EventProperties | undefined]> = []

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    mandalartGaConfigured?: boolean
  }
}

export function sendGoogleAnalyticsEvent(
  name: string,
  properties?: EventProperties
) {
  if (!PRODUCTION_HOSTS.has(window.location.hostname)) return
  if (window.mandalartGaConfigured) {
    window.gtag?.('event', name, { ...properties, send_to: MEASUREMENT_ID })
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
    window.gtag ??= function () {
      // Google tag consumes the Arguments object used by its standard snippet.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments)
    }

    if (!window.mandalartGaConfigured) {
      window.gtag('js', new Date())
      const attribution = captureAttribution()
      window.gtag('config', MEASUREMENT_ID, {
        campaign_source: attribution.utm_source, campaign_medium: attribution.utm_medium,
        campaign_name: attribution.utm_campaign, campaign_content: attribution.utm_content, campaign_term: attribution.utm_term,
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
      send_to: MEASUREMENT_ID,
    })
    previousPage.current = pageLocation
    for (const [name, properties] of pendingEvents.splice(0)) {
      window.gtag('event', name, { ...properties, send_to: MEASUREMENT_ID })
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
