import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  processKiwifyEvent,
  validateKiwifyEvent,
  verifyKiwifySignature,
} from './kiwify'

const mocks = vi.hoisted(() => ({ db: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/stripe', () => ({ billingMode: () => 'live' }))

const id = '60e62b8f-e9ac-4f97-94e8-6d27732fbd5e'
const saleId = '462428b6-e3b3-4d65-9c9f-c2ed064add61'
const event = {
  order_id: saleId,
  order_status: 'paid',
  webhook_event_type: 'order_approved',
  Product: { product_id: 'product-test' },
  Commissions: {
    charge_amount: '3990',
    currency: 'BRL',
    product_base_price: '3990',
    product_base_price_currency: 'BRL',
  },
  TrackingParameters: { sck: id },
  checkout_link: 'offer123',
}

beforeEach(() => {
  vi.stubEnv('KIWIFY_WEBHOOK_TOKEN', 'unit-test-token')
  vi.stubEnv('KIWIFY_PRODUCT_ID', 'product-test')
  vi.stubEnv('KIWIFY_CHECKOUT_ONE', 'https://pay.kiwify.com.br/offer123')
  mocks.db.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

it('accepts only a matching signed body', () => {
  const body = JSON.stringify(event)
  const signature = createHmac('sha1', 'unit-test-token')
    .update(body)
    .digest('hex')
  expect(verifyKiwifySignature(body, signature)).toBe(true)
  expect(verifyKiwifySignature(JSON.stringify({ ...event, order_status: 'refunded' }), signature)).toBe(false)
  expect(verifyKiwifySignature(body, '0'.repeat(40))).toBe(false)
  expect(verifyKiwifySignature(body, null)).toBe(false)
})

it('requires paid status, expected product and a correlatable order', () => {
  expect(validateKiwifyEvent(event)).toMatchObject({ id, amount: 3990 })
  expect(validateKiwifyEvent({ ...event, order_status: 'waiting_payment' })).toBeNull()
  expect(validateKiwifyEvent({ ...event, Product: { product_id: 'other' } })).toBeNull()
  expect(validateKiwifyEvent({ ...event, TrackingParameters: { sck: null } })).toBeNull()
})

it('credits only a matching persisted Kiwify order', async () => {
  mocks.db.mockImplementation(async (strings: TemplateStringsArray) => {
    const query = strings.join('?')
    if (query.includes('SELECT id, mode'))
      return [{ id, mode: 'live', provider: 'kiwify', credits: 1, amount: 3990, price_id: 'offer123', external_order_id: null }]
    if (query.includes('UPDATE dream_orders SET external_order_id')) return [{ id }]
    return [{ dream_reconcile_order: 1 }]
  })
  expect(await processKiwifyEvent(event)).toBe('processed')
  expect(mocks.db).toHaveBeenCalledTimes(3)

  mocks.db.mockClear()
  await expect(processKiwifyEvent({ ...event, Commissions: { ...event.Commissions, charge_amount: '500' } })).rejects.toThrow(
    'Evento Kiwify não corresponde ao pedido.',
  )
  expect(mocks.db).toHaveBeenCalledTimes(1)
})
