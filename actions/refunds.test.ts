import { beforeEach, expect, it, vi } from 'vitest'
import { getPurchaseHistory, requestDreamRefund } from './refunds'

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  sql: vi.fn(),
  create: vi.fn(),
  reconcile: vi.fn(),
  asaasRefund: vi.fn(),
  reconcileAsaasCheckout: vi.fn(),
  reconcileAsaasPix: vi.fn(),
  kiwifyConfigured: vi.fn(),
  kiwifyVerify: vi.fn(),
  kiwifyRefund: vi.fn(),
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
vi.mock('@/lib/kiwify-refunds', () => ({
  KiwifyRefundRejectedError: class KiwifyRefundRejectedError extends Error {},
  kiwifyRefundConfigured: mocks.kiwifyConfigured,
  verifyKiwifySaleForRefund: mocks.kiwifyVerify,
  refundKiwifySale: mocks.kiwifyRefund,
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
  mocks.kiwifyConfigured.mockReturnValue(true)
  mocks.kiwifyVerify.mockResolvedValue(undefined)
  mocks.kiwifyRefund.mockResolvedValue(undefined)
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

it('verifies the Kiwify sale and claims the order before requesting a refund', async () => {
  const saleId = 'd7224591-861e-4eb9-8411-a321dfaf673b'
  mocks.sql.mockResolvedValueOnce([{ ...order, provider: 'kiwify', external_order_id: saleId,
    payment_intent_id: null, session_id: null }]).mockResolvedValueOnce([{ id }])
  await expect(requestDreamRefund(id)).resolves.toEqual({ accepted: true })
  expect(mocks.kiwifyVerify).toHaveBeenCalledWith(saleId, id, 3700)
  expect(mocks.kiwifyRefund).toHaveBeenCalledWith(saleId)
  expect(mocks.kiwifyVerify.mock.invocationCallOrder[0]).toBeLessThan(mocks.kiwifyRefund.mock.invocationCallOrder[0])
})

it('does not send a second Kiwify refund when the order is already claimed', async () => {
  mocks.sql.mockResolvedValueOnce([{ ...order, provider: 'kiwify', external_order_id: 'd7224591-861e-4eb9-8411-a321dfaf673b' }])
    .mockResolvedValueOnce([])
  await expect(requestDreamRefund(id)).rejects.toThrow('em análise')
  expect(mocks.kiwifyRefund).not.toHaveBeenCalled()
})

it('allows retry after Kiwify explicitly rejects a refund', async () => {
  const { KiwifyRefundRejectedError } = await import('@/lib/kiwify-refunds')
  mocks.sql.mockResolvedValueOnce([{ ...order, provider: 'kiwify', external_order_id: 'd7224591-861e-4eb9-8411-a321dfaf673b' }])
    .mockResolvedValueOnce([{ id }]).mockResolvedValueOnce([])
  mocks.kiwifyRefund.mockRejectedValueOnce(new KiwifyRefundRejectedError('rejected'))
  await expect(requestDreamRefund(id)).rejects.toThrow('rejected')
  expect(mocks.sql).toHaveBeenCalledTimes(3)
  expect(String(mocks.sql.mock.calls[2][0][0])).toContain('refund_requested_at=NULL')
})

it('shows paid and refunded purchases, and only offers a refund for an eligible payment', async () => {
  const paidAt = new Date().toISOString()
  mocks.sql.mockResolvedValueOnce([
    { ...order, provider: 'asaas', payment_method: 'PIX', refunded: 0,
      external_order_id: 'pay_test', asaas_pix_qr_id: 'qr_test', payment_intent_id: null,
      session_id: null, created_at: paidAt, refund_requested_at: null },
    { ...order, id: 'c112b423-6396-40ba-961d-b04b3e821621', status: 'refunded',
      provider: 'asaas', payment_method: 'CREDIT_CARD', refunded: 3700,
      external_order_id: 'pay_refunded', asaas_pix_qr_id: null,
      created_at: paidAt, refund_requested_at: paidAt },
  ])

  const purchases = await getPurchaseHistory()
  expect(purchases).toHaveLength(2)
  expect(purchases?.[0]).toMatchObject({ method: 'PIX', status: 'paid', canRefund: true })
  expect(purchases?.[1]).toMatchObject({ method: 'CREDIT_CARD', status: 'refunded', canRefund: false })
})
