import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  processKiwifyEvent,
  validateKiwifyEvent,
  verifyKiwifySignature,
} from './kiwify'

const mocks = vi.hoisted(() => ({ db: vi.fn(), fulfill: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/stripe', () => ({ billingMode: () => 'live' }))
vi.mock('@/lib/order-fulfillment', () => ({ fulfillOrder: mocks.fulfill }))

const id = '60e62b8f-e9ac-4f97-94e8-6d27732fbd5e'
const saleId = '462428b6-e3b3-4d65-9c9f-c2ed064add61'
const event = {
  order_id: saleId,
  order_status: 'paid',
  webhook_event_type: 'order_approved',
  Product: { product_id: 'product-test' },
  Customer: { email: 'buyer@example.com' },
  payment_method: 'pix',
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
  mocks.fulfill.mockReset()
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

it('fulfills only a matching persisted Kiwify order', async () => {
  mocks.db.mockImplementation(async (strings: TemplateStringsArray) => {
    const query = strings.join('?')
    if (query.includes('SELECT *'))
      return [{ id, mode: 'live', provider: 'kiwify', credits: 1, amount: 3990, price_id: 'offer123', external_order_id: null, preview_id: 'preview' }]
    if (query.includes('UPDATE dream_orders SET external_order_id')) return [{ id }]
    return []
  })
  expect(await processKiwifyEvent(event)).toBe('processed')
  expect(mocks.fulfill).toHaveBeenCalledWith(expect.objectContaining({ paid: true, paidEmail: 'buyer@example.com', source: 'comecar', bump: false }))

  mocks.db.mockClear()
  await expect(processKiwifyEvent({ ...event, Commissions: { ...event.Commissions, charge_amount: '500' } })).rejects.toThrow(
    'Evento Kiwify não corresponde ao pedido.',
  )
  expect(mocks.db).toHaveBeenCalledTimes(1)
})

it('delivers the public three-pack at R$ 99 and reverses a refund', async () => {
  const three = { ...event, checkout_link: 'three123', Commissions: { ...event.Commissions, charge_amount: '9900', product_base_price: '9900' } }
  vi.stubEnv('KIWIFY_CHECKOUT_THREE', 'https://pay.kiwify.com.br/three123')
  mocks.db.mockImplementation(async (strings: TemplateStringsArray) =>
    strings.join('?').includes('SELECT *')
      ? [{ id, mode: 'live', provider: 'kiwify', credits: 3, amount: 9900, price_id: 'three123', external_order_id: null, preview_id: 'preview' }]
      : [{ id }])
  expect(await processKiwifyEvent(three)).toBe('processed')
  expect(mocks.fulfill).toHaveBeenCalledWith(expect.objectContaining({ paid: true, bump: true, source: 'comecar' }))
  expect(await processKiwifyEvent({ ...three, order_status: 'refunded', webhook_event_type: 'order_refunded' })).toBe('processed')
  expect(mocks.fulfill).toHaveBeenCalledWith(expect.objectContaining({ paid: false, refunded: 9900 }))
})
