import { beforeEach, expect, it, vi } from 'vitest'
import { requestDreamRefund } from './refunds'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  sql: vi.fn(),
  create: vi.fn(),
  reconcile: vi.fn(),
  asaasRefund: vi.fn(),
  reconcileAsaasCheckout: vi.fn(),
  reconcileAsaasPix: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/actions/auth', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.sql }))
vi.mock('@/lib/stripe', () => ({ billingMode: () => 'test', paymentProvider: () => 'stripe', getStripe: () => ({ refunds: { create: mocks.create } }) }))
vi.mock('@/lib/payments', () => ({ reconcileCheckout: mocks.reconcile }))
vi.mock('@/lib/asaas', () => ({ refundAsaasPayment: mocks.asaasRefund }))
vi.mock('@/lib/asaas-payments', () => ({
  reconcileAsaasCheckout: mocks.reconcileAsaasCheckout,
  reconcileAsaasPix: mocks.reconcileAsaasPix,
}))

const id = 'b857878a-22e1-4190-a04f-611d6e03d2a0'
const order = {
  id,
  amount: 3700,
  credits: 1,
  paid_at: new Date().toISOString(),
  payment_intent_id: 'pi_test_order',
  session_id: 'cs_test_order',
  status: 'paid',
  provider: 'stripe',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user.mockResolvedValue({ id: 'buyer' })
  mocks.sql.mockResolvedValue([order])
  mocks.create.mockResolvedValue({ id: 're_test' })
  mocks.asaasRefund.mockResolvedValue({ id: 'pay_test' })
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

it('refunds a direct Asaas Pix payment without requiring a checkout session', async () => {
  mocks.sql.mockResolvedValue([{ ...order, provider: 'asaas', payment_intent_id: null, session_id: null,
    asaas_pix_qr_id: 'qr_test', external_order_id: 'pay_test' }])
  await expect(requestDreamRefund(id)).resolves.toEqual({ accepted: true })
  expect(mocks.reconcileAsaasPix).toHaveBeenCalledWith(id, 'buyer', true)
  expect(mocks.reconcileAsaasPix).toHaveBeenCalledTimes(2)
  expect(mocks.asaasRefund).toHaveBeenCalledWith('pay_test')
  expect(mocks.reconcileAsaasCheckout).not.toHaveBeenCalled()
})
