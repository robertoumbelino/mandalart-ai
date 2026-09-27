import { afterEach, expect, it, vi } from 'vitest'
import { captureAttribution, cleanAttribution } from './attribution'

afterEach(() => vi.unstubAllGlobals())

it('keeps campaign parameters after a route loses its query string', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', { location: { search: '?utm_source=meta&utm_campaign=career' } })
  expect(captureAttribution()).toMatchObject({ utm_source: 'meta', utm_campaign: 'career' })

  vi.stubGlobal('window', { location: { search: '' } })
  expect(captureAttribution()).toEqual({ utm_source: 'meta', utm_campaign: 'career' })
})

it('accepts only bounded attribution fields before adding them to an order', () => {
  expect(cleanAttribution({ utm_source: ' meta ', utm_campaign: 'x'.repeat(151), arbitrary: 'ignored' }))
    .toEqual({ utm_source: 'meta' })
})
