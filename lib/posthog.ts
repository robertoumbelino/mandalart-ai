'use client'

import posthog from 'posthog-js'
import { isProductionAnalyticsOrigin } from './analytics-environment'

export const POSTHOG_OPTOUT_KEY = 'mandalart.posthog-opt-out.v1'

let initialized = false
let userId: string | null = null
let optedOut = false

function isProductionBrowser() {
  return typeof window !== 'undefined' && isProductionAnalyticsOrigin(window.location.origin)
}

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
  if (!isProductionBrowser()) return false
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (optedOut) return false
  try {
    if (localStorage.getItem(POSTHOG_OPTOUT_KEY) === 'true') {
      optedOut = true
      return false
    }
  } catch {
    // Analytics remains available when storage is blocked.
  }
  if (initialized || !token || !host) return initialized

  posthog.init(token, {
    api_host: host,
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: { email: true, password: true },
      maskTextSelector: '.ph-mask',
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
  if (!startPostHog()) return false
  posthog.capture(name, { ...properties, site_environment: 'production', journey_version: 'conversion-v2' })
  return true
}

export function stopPostHog() {
  optedOut = true
  try { localStorage.setItem(POSTHOG_OPTOUT_KEY, 'true') } catch {}
  if (initialized) {
    posthog.stopSessionRecording()
    posthog.opt_out_capturing()
  }
}

export function resumePostHog() {
  optedOut = false
  try { localStorage.removeItem(POSTHOG_OPTOUT_KEY) } catch {}
  if (!isProductionBrowser()) return
  if (initialized) {
    posthog.opt_in_capturing()
    posthog.startSessionRecording()
  }
  else startPostHog()
}

export function identifyProductUser(id: string) {
  userId = id
  if (isProductionBrowser() && initialized && !optedOut) posthog.identify(id)
}

export function resetProductUser() {
  userId = null
  if (isProductionBrowser() && initialized) {
    posthog.reset()
    if (optedOut) posthog.opt_out_capturing()
  }
}

export function getProductDistinctId(): string | undefined {
  if (!startPostHog()) return undefined
  return posthog.get_distinct_id()
}
