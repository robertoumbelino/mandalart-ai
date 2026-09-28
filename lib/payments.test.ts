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
  accessEmail: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.sql }))
vi.mock('@/lib/transactional-email', () => ({ cancelRecoveryEmails: vi.fn(), sendAccessEmail: mocks.accessEmail }))
vi.mock('@/lib/meta-capi', () => ({ sendMetaPurchase: vi.fn() }))
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
  it('accepts a guest purchase with only the main plan', () => {
    const guest = { ...order, user_id: null, guest_email: null, preview_id: 'preview-id', credits: 1 as const, amount: 3700, price_id: 'price_one', bump_price_id: 'price_bump' }
    const checkout = { ...session, client_reference_id: order.id, amount_total: 3700 } as Stripe.Checkout.Session
    const items = [{ quantity: 1, price: { id: 'price_one' }, amount_total: 3700 }] as Stripe.LineItem[]
    expect(verifyCheckout(checkout, guest, items)).toEqual({ amount: 3700, credits: 1, bump: false })
  })
  it('accepts only the exact R$62 guest add-on and credits three dreams', () => {
    const guest = { ...order, user_id: null, guest_email: null, preview_id: 'preview-id', credits: 1 as const, amount: 3700, price_id: 'price_one', bump_price_id: 'price_bump' }
    const checkout = { ...session, client_reference_id: order.id, amount_total: 9900 } as Stripe.Checkout.Session
    const items = [
      { quantity: 1, price: { id: 'price_one' }, amount_total: 3700 },
      { quantity: 1, price: { id: 'price_bump' }, amount_total: 6200 },
    ] as Stripe.LineItem[]
    expect(verifyCheckout(checkout, guest, items)).toEqual({ amount: 9900, credits: 3, bump: true })
    expect(() => verifyCheckout(checkout, guest, [{ ...items[0] }, { ...items[1], quantity: 2 }])).toThrow()
    expect(() => verifyCheckout(checkout, guest, [{ ...items[0] }, { ...items[1], price: { id: 'another_price' } } as Stripe.LineItem])).toThrow()
  })
  it('binds a paid email-free preview order to the Stripe email and sends access', async () => {
    const guest = { ...order, user_id: null, guest_email: null, lead_id: null, preview_id: 'a857878a-22e1-4190-a04f-611d6e03d2a0', credits: 1 as const, amount: 3700, price_id: 'price_one', bump_price_id: 'price_bump' }
    const checkout = { ...session, client_reference_id: order.id, amount_total: 3700, customer_details: { email: 'buyer@example.com' } } as Stripe.Checkout.Session
    mocks.retrieve.mockResolvedValue(checkout)
    mocks.lines.mockResolvedValue({ data: [{ quantity: 1, price: { id: 'price_one' }, amount_total: 3700 }] })
    mocks.intent.mockResolvedValue({ status: 'succeeded', amount_received: 3700, currency: 'brl', latest_charge: null })
    mocks.sql.mockImplementation(async (strings: TemplateStringsArray) => {
      const query = strings.join('')
      if (query.startsWith('SELECT * FROM dream_orders')) return [guest]
      if (query.startsWith('SELECT id FROM users WHERE')) return []
      if (query.startsWith('INSERT INTO users')) return [{ id: 'new-user' }]
      if (query.startsWith('SELECT user_id,guest_email')) return [{ user_id: 'new-user', guest_email: 'buyer@example.com' }]
      if (query.startsWith('SELECT status,credited')) return [{ status: 'paid', credited: 1 }]
      if (query.startsWith('SELECT session_id,attribution FROM onboarding_previews')) return [{ session_id: 'preview-session', attribution: {} }]
      if (query.startsWith('UPDATE dream_orders SET access_email_sending_at')) return [{ id: guest.id }]
      if (query.startsWith('SELECT access_email_sent_at')) return [{ access_email_sent_at: null }]
      return []
    })
    const result = await reconcileCheckout(checkout.id)
    expect(result).toMatchObject({ status: 'paid', credits: 1, amount: 3700 })
    expect(mocks.accessEmail).toHaveBeenCalledWith(guest.id, 'new-user', 'buyer@example.com')
    expect(mocks.sql.mock.calls.some(call => call[0].join('').includes("'purchase_completed'"))).toBe(true)
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
    const confirmed = await reconcileCheckout(session.id)
    const call = mocks.sql.mock.calls.find((c) =>
      c[0].join('').includes('dream_reconcile_order'),
    )!
    expect(call.slice(1, 5)).toEqual([order.id, true, 0, false])
    expect(confirmed).toMatchObject({ id: order.id, status: 'paid', amount: 9990, mode: 'test' })
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
