'use client'

import { ANALYTICS_CONSENT_KEY } from '@/lib/posthog'

type EventName = 'CompleteRegistration' | 'InitiateCheckout' | 'Purchase'
type EventData = { value?: number; currency?: 'BRL' }
type PendingEvent = { name: EventName; data?: EventData; onceKey?: string; eventId?: string }

const pending: PendingEvent[] = []

function consented() {
  try {
    return localStorage.getItem(ANALYTICS_CONSENT_KEY) === 'accepted'
  } catch {
    return false
  }
}

export function flushMetaEvents() {
  if (!consented() || !window.fbq) return
  for (const event of pending.splice(0)) {
    const key = event.onceKey && `mandalart.meta.${event.onceKey}`
    try {
      if (key && localStorage.getItem(key)) continue
      window.fbq('track', event.name, event.data, event.eventId ? { eventID: event.eventId } : undefined)
      if (key) localStorage.setItem(key, '1')
    } catch {
      // Tracking never interrupts registration or checkout.
    }
  }
}

export function trackMetaEvent(event: PendingEvent) {
  if (typeof window === 'undefined') return
  if (event.onceKey && pending.some((item) => item.onceKey === event.onceKey)) return
  pending.push(event)
  flushMetaEvents()
}

export function discardMetaEvents() {
  pending.length = 0
}
