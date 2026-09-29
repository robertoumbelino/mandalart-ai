import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { capturePaidOrder } from './product-analytics-server'
vi.mock('server-only', () => ({}))
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('APP_URL', 'https://mandalart.com.br')
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'test-token')
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://us.i.posthog.com')
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
const order = { id: 'e132f1ec-c98a-4829-8682-a3e334992222', amount: 9900, credits: 3, mode: 'live', analytics_distinct_id: 'visitor-1', purchase_confirmed_at: '2026-09-28T20:00:00Z' }
it('uses a stable identity and BRL amount on retried paid-order events', async () => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN','test-token')
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST','https://us.i.posthog.com')
  const send = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch',send)
  await capturePaidOrder(order)
  await capturePaidOrder(order)
  const first = JSON.parse(send.mock.calls[0][1].body)
  expect(first).toEqual(JSON.parse(send.mock.calls[1][1].body))
  expect(first).toMatchObject({ uuid: order.id, timestamp: order.purchase_confirmed_at, distinct_id: 'visitor-1', properties: { value: 99, currency: 'BRL', order_id: order.id, credits: 3 } })
})
it('does not send sandbox purchases or opted-out visitors', async () => {
  const send = vi.fn(); vi.stubGlobal('fetch',send)
  expect(await capturePaidOrder({ ...order, mode: 'test' })).toBe(false)
  expect(await capturePaidOrder({ ...order, analytics_distinct_id: null })).toBe(false)
  expect(send).not.toHaveBeenCalled()
})

it.each([
  ['development', undefined, 'https://mandalart.com.br'],
  ['production', undefined, 'http://localhost:3100'],
  ['production', 'preview', 'https://mandalart.com.br'],
  ['production', 'production', 'https://mandalart-ai-preview.vercel.app'],
  ['production', 'production', undefined],
])('does not send live orders outside production (%s, %s, %s)', async (environment, deployment, origin) => {
  vi.stubEnv('NODE_ENV', environment)
  vi.stubEnv('VERCEL_ENV', deployment)
  vi.stubEnv('APP_URL', origin)
  const send = vi.fn()
  vi.stubGlobal('fetch', send)
  expect(await capturePaidOrder(order)).toBe(false)
  expect(send).not.toHaveBeenCalled()
})
