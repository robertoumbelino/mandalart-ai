import { beforeEach, expect, it, vi } from 'vitest'
import { requestDreamRefund } from './refunds'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  sql: vi.fn(),
  create: vi.fn(),
  reconcile: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/actions/auth', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.sql }))
vi.mock('@/lib/stripe', () => ({ billingMode: () => 'test', getStripe: () => ({ refunds: { create: mocks.create } }) }))
vi.mock('@/lib/payments', () => ({ reconcileCheckout: mocks.reconcile }))

const id = 'b857878a-22e1-4190-a04f-611d6e03d2a0'
const order = {
  id,
  amount: 3700,
  credits: 1,
  paid_at: new Date().toISOString(),
  payment_intent_id: 'pi_test_order',
  session_id: 'cs_test_order',
  status: 'paid',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user.mockResolvedValue({ id: 'buyer' })
  mocks.sql.mockResolvedValue([order])
  mocks.create.mockResolvedValue({ id: 're_test' })
})

it('refunds only an authenticated paid order through the original payment', async () => {
  await expect(requestDreamRefund(id)).resolves.toEqual({ accepted: true })
  expect(mocks.create).toHaveBeenCalledWith(
    { payment_intent: 'pi_test_order', reason: 'requested_by_customer', metadata: { app: 'mandalart', order_id: id, source: 'seven_day_guarantee' } },
    { idempotencyKey: `mandalart-guarantee-${id}` },
  )
  expect(mocks.reconcile).toHaveBeenCalledWith('cs_test_order', 'buyer')
})

it('does not refund a purchase from another account', async () => {
  mocks.sql.mockResolvedValue([])
  await expect(requestDreamRefund(id)).rejects.toThrow('Compra não encontrada')
  expect(mocks.create).not.toHaveBeenCalled()
})

it('does not refund a purchase after the guarantee period', async () => {
  mocks.sql.mockResolvedValue([{ ...order, paid_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() }])
  await expect(requestDreamRefund(id)).rejects.toThrow('prazo de 7 dias')
  expect(mocks.create).not.toHaveBeenCalled()
})
