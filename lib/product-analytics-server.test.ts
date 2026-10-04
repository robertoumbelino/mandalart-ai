import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { capturePaidOrder, captureGeneratedPlan } from './product-analytics-server'
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

it('uses the persisted order version on confirmed purchases', async () => {
  const send = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', send)
  await capturePaidOrder({ ...order, journey_version: 'sales-v3' })
  expect(JSON.parse(send.mock.calls[0][1].body).properties.journey_version).toBe('sales-v3')
})
it('deduplicates saved-plan retries separately from the paid-order event', async () => {
  const send = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal('fetch', send)
  const plan = { id: '7b0bfbb2-68de-4ce7-a0be-df91d9f5aa04', orderId: order.id, mode: 'live', analyticsDistinctId: 'visitor-1', journeyVersion: 'sales-v3' }
  await captureGeneratedPlan(plan)
  await captureGeneratedPlan(plan)
  const first = JSON.parse(send.mock.calls[0][1].body)
  expect(first.uuid).not.toBe(order.id)
  expect(first).toEqual(JSON.parse(send.mock.calls[1][1].body))
  expect(first).toMatchObject({ event: 'plan_generated', distinct_id: 'visitor-1', properties: { journey_version: 'sales-v3', order_id: order.id } })
  expect(await captureGeneratedPlan({ ...plan, mode: 'test' })).toBe(false)
  expect(send).toHaveBeenCalledTimes(2)
})
