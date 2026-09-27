import { afterEach, expect, it, vi } from 'vitest'
import { discardMetaEvents, trackMetaEvent } from './meta-events'
import { ANALYTICS_CONSENT_KEY } from './posthog'

afterEach(() => {
  discardMetaEvents()
  vi.unstubAllGlobals()
})

it('sends Purchase once for each confirmed order across repeated renders', () => {
  const values = new Map<string, string>([[ANALYTICS_CONSENT_KEY, 'accepted']])
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  })
  const fbq = vi.fn()
  vi.stubGlobal('window', { fbq })
  const purchase = (id: string) => trackMetaEvent({
    name: 'Purchase',
    data: { value: 37, currency: 'BRL' },
    onceKey: `purchase.${id}`,
    eventId: `purchase-${id}`,
  })
  purchase('order-one')
  purchase('order-one')
  purchase('order-two')
  expect(fbq).toHaveBeenCalledTimes(2)
  expect(fbq).toHaveBeenCalledWith('track', 'Purchase', { value: 37, currency: 'BRL' }, { eventID: 'purchase-order-one' })
})
