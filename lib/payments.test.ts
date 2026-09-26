import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import {
  verifyCheckout,
  reconcileCheckout,
  processStripeEvent,
  type DreamOrder,
} from './payments'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
  retrieve: vi.fn(),
  lines: vi.fn(),
  intent: vi.fn(),
  disputes: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.sql }))
vi.mock('@/lib/stripe', () => ({
  billingMode: () => 'test',
  getStripe: () => ({
    checkout: {
      sessions: { retrieve: mocks.retrieve, listLineItems: mocks.lines },
    },
    paymentIntents: { retrieve: mocks.intent },
    disputes: { list: mocks.disputes },
  }),
}))
const order: DreamOrder = {
  id: 'b857878a-22e1-4190-a04f-611d6e03d2a0',
  user_id: 'user',
  mode: 'test',
  credits: 3,
  amount: 9990,
  price_id: 'price_three',
  session_id: 'cs_test_sample',
  status: 'pending',
}
const session = {
  id: 'cs_test_sample',
  livemode: false,
  mode: 'payment',
  metadata: { app: 'mandalart', order_id: order.id },
  client_reference_id: 'user',
  currency: 'brl',
  amount_total: 9990,
  payment_status: 'paid',
  payment_intent: 'pi_test',
  status: 'complete',
} as unknown as Stripe.Checkout.Session
const lines = [
  { quantity: 1, price: { id: 'price_three' }, amount_total: 9990 },
] as Stripe.LineItem[]
beforeEach(() => {
  vi.clearAllMocks()
  mocks.sql.mockImplementation(async (strings: TemplateStringsArray) =>
    strings.join('').startsWith('SELECT *')
      ? [order]
      : strings.join('').startsWith('SELECT status')
        ? [{ status: 'paid', credited: 3 }]
        : [],
  )
  mocks.retrieve.mockResolvedValue(session)
  mocks.lines.mockResolvedValue({ data: lines })
  mocks.intent.mockResolvedValue({
    status: 'succeeded',
    amount_received: 9990,
    currency: 'brl',
    latest_charge: { id: 'ch_1', amount_refunded: 0, disputed: false },
  })
})
describe('trusted checkout fulfillment', () => {
  it('validates the exact server-side offer', () =>
    expect(() => verifyCheckout(session, order, lines)).not.toThrow())
  it('continues to reconcile an order created at the previous single-dream price', () => {
    const previousOrder = { ...order, credits: 1 as const, amount: 3990, price_id: 'price_one_old' }
    const previousSession = { ...session, amount_total: 3990 } as Stripe.Checkout.Session
    const previousLines = [
      { quantity: 1, price: { id: 'price_one_old' }, amount_total: 3990 },
    ] as Stripe.LineItem[]
    expect(() => verifyCheckout(previousSession, previousOrder, previousLines)).not.toThrow()
  })
  it.each([
    { livemode: true },
    { amount_total: 1 },
    { currency: 'usd' },
    { client_reference_id: 'another-user' },
    { metadata: { app: 'other', order_id: order.id } },
    { id: 'another-session' },
    { mode: 'subscription' },
  ])('rejects mismatched checkout %j', (patch) =>
    expect(() =>
      verifyCheckout(
        { ...session, ...patch } as Stripe.Checkout.Session,
        order,
        lines,
      ),
    ).toThrow(),
  )
  it('rejects a price substitution', () =>
    expect(() =>
      verifyCheckout(session, order, [
        { ...lines[0], price: { id: 'cheap_price' } } as Stripe.LineItem,
      ]),
    ).toThrow())
  it('rejects quantity manipulation', () =>
    expect(() =>
      verifyCheckout(session, order, [{ ...lines[0], quantity: 3 }]),
    ).toThrow())
  it('rejects a return belonging to another account', async () => {
    await expect(reconcileCheckout(session.id, 'attacker')).rejects.toThrow(
      'Compra não encontrada',
    )
    expect(mocks.intent).not.toHaveBeenCalled()
  })
  it('requires both session payment and intent confirmation', async () => {
    mocks.retrieve.mockResolvedValue({ ...session, payment_status: 'unpaid' })
    await reconcileCheckout(session.id)
    const call = mocks.sql.mock.calls.find((c) =>
      c[0].join('').includes('dream_reconcile_order'),
    )!
    expect(call[2]).toBe(false)
  })
  it('never credits a processing Pix intent', async () => {
    mocks.intent.mockResolvedValue({
      status: 'processing',
      currency: 'brl',
      amount_received: 0,
      latest_charge: null,
    })
    await reconcileCheckout(session.id)
    const call = mocks.sql.mock.calls.find((c) =>
      c[0].join('').includes('dream_reconcile_order'),
    )!
    expect(call[2]).toBe(false)
  })
  it('credits only after authoritative payment verification', async () => {
    await reconcileCheckout(session.id)
    const call = mocks.sql.mock.calls.find((c) =>
      c[0].join('').includes('dream_reconcile_order'),
    )!
    expect(call.slice(1, 5)).toEqual([order.id, true, 0, false])
  })
  it('forwards async success to the same idempotent reconciliation', async () => {
    await processStripeEvent({
      livemode: false,
      type: 'checkout.session.async_payment_succeeded',
      data: { object: { id: session.id } },
    } as Stripe.Event)
    expect(mocks.retrieve).toHaveBeenCalledWith(session.id)
  })
  it('rejects live events in test', async () => {
    await expect(
      processStripeEvent({ livemode: true } as Stripe.Event),
    ).rejects.toThrow('Ambiente')
    expect(mocks.retrieve).not.toHaveBeenCalled()
  })
})
