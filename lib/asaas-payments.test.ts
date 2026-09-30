import { describe, expect, it, vi } from 'vitest'
import { asaasPaymentState, asaasPixPaymentState, selectAsaasPayment } from './asaas-payments'
import type { AsaasPayment } from './asaas'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/stripe', () => ({ billingMode: () => 'test' }))

const order = {
  id: 'b857878a-22e1-4190-a04f-611d6e03d2a0',
  user_id: 'buyer',
  mode: 'test' as const,
  provider: 'asaas',
  credits: 1 as const,
  amount: 3700,
  price_id: 'asaas:account:1',
  session_id: 'checkout-id',
  status: 'pending',
}
const payment: AsaasPayment = {
  id: 'pay_test', customer: 'cus_test', checkoutSession: 'checkout-id',
  status: 'CONFIRMED', billingType: 'CREDIT_CARD', value: 37,
}

describe('Asaas reconciliation checks', () => {
  it('credits a confirmed card or received Pix, never an awaiting payment', () => {
    expect(asaasPaymentState(payment, order).paid).toBe(true)
    expect(asaasPaymentState({ ...payment, billingType: 'PIX', status: 'RECEIVED' }, order).paid).toBe(true)
    expect(asaasPaymentState({ ...payment, status: 'PENDING' }, order).paid).toBe(false)
    expect(asaasPaymentState({ ...payment, status: 'AWAITING_RISK_ANALYSIS' }, order).paid).toBe(false)
  })

  it('reverses a full refund and a chargeback, and rejects a different amount or checkout', () => {
    expect(asaasPaymentState({ ...payment, status: 'REFUNDED' }, order).refunded).toBe(3700)
    expect(asaasPaymentState({ ...payment, status: 'CHARGEBACK_REQUESTED' }, order).disputed).toBe(true)
    expect(() => asaasPaymentState({ ...payment, value: 36 }, order)).toThrow('não corresponde')
    expect(() => asaasPaymentState({ ...payment, checkoutSession: 'other' }, order)).toThrow('não corresponde')
  })

  it('selects the confirmed card after an abandoned Pix in the same checkout', () => {
    const pendingPix = { ...payment, id: 'pay_pix', billingType: 'PIX', status: 'PENDING' }
    expect(selectAsaasPayment([pendingPix, payment], order)?.id).toBe(payment.id)
    expect(() => selectAsaasPayment([payment, { ...payment, id: 'pay_other' }], order)).toThrow('múltiplos pagamentos')
  })

  it('confirms only Pix payments tied to the exact one-use QR and amount', () => {
    const pixOrder = { ...order, session_id: null, asaas_pix_qr_id: 'qr_123' }
    const pixPayment = { ...payment, checkoutSession: null, pixQrCodeId: 'qr_123', billingType: 'PIX', status: 'PENDING' }
    expect(asaasPixPaymentState(pixPayment, pixOrder).paid).toBe(false)
    expect(asaasPixPaymentState({ ...pixPayment, status: 'RECEIVED' }, pixOrder).paid).toBe(true)
    expect(asaasPixPaymentState({ ...pixPayment, status: 'REFUNDED' }, pixOrder).refunded).toBe(3700)
    expect(() => asaasPixPaymentState({ ...pixPayment, pixQrCodeId: 'other' }, pixOrder)).toThrow('não corresponde')
    expect(() => asaasPixPaymentState({ ...pixPayment, value: 36 }, pixOrder)).toThrow('não corresponde')
    expect(() => asaasPixPaymentState({ ...pixPayment, billingType: 'CREDIT_CARD' }, pixOrder)).toThrow('não corresponde')
  })
})
