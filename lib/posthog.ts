'use client'

import posthog from 'posthog-js'

export const ANALYTICS_CONSENT_KEY = 'mandalart.analytics-consent.v2'
export const ANALYTICS_CONSENT_EVENT = 'mandalart:analytics-consent'

let initialized = false
let userId: string | null = null

function withoutQuery(value: unknown) {
  if (typeof value !== 'string') return value
  try {
    const url = new URL(value, window.location.origin)
    return `${url.origin}${url.pathname}`
  } catch {
    return value.split(/[?#]/, 1)[0]
  }
}

export function startPostHog() {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (initialized || !token || !host) return initialized

  posthog.init(token, {
    api_host: host,
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '*',
      recordHeaders: false,
      recordBody: false,
      captureJsonLd: false,
      maskCapturedNetworkRequestFn: request => request.isInitial ? {
        ...request,
        name: withoutQuery(request.name) as string,
        requestHeaders: undefined,
        requestBody: undefined,
        responseHeaders: undefined,
        responseBody: undefined,
      } : null,
    },
    before_send: event => {
      if (!event) return event
      for (const key of ['$current_url', '$referrer', '$initial_referrer']) {
        if (key in event.properties) event.properties[key] = withoutQuery(event.properties[key])
      }
      return event
    },
  })
  initialized = true
  if (userId) posthog.identify(userId)
  return true
}

export function captureProductEvent(name: string, properties?: Record<string, string | number>) {
  if (!initialized) return false
  const siteEnvironment = /^(www\.)?mandalart\.com\.br$/.test(window.location.hostname)
    || window.location.hostname === 'mandalart-ai.vercel.app'
    ? 'production'
    : 'development'
  posthog.capture(name, { ...properties, site_environment: siteEnvironment })
  return true
}

export function identifyProductUser(id: string) {
  userId = id
  if (initialized) posthog.identify(id)
}

export function resetProductUser() {
  userId = null
  if (initialized) posthog.reset()
}
