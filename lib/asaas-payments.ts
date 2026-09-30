import 'server-only'
import { getDb } from '@/lib/db'
import { billingMode } from '@/lib/stripe'
import {
  getAsaasCheckoutPayments,
  getAsaasPixPayments,
  getAsaasCustomerEmail,
  getAsaasPayment,
  type AsaasPayment,
} from '@/lib/asaas'
import { fulfillOrder } from '@/lib/order-fulfillment'
import type { DreamOrder } from '@/lib/payments'

type AsaasOrder = DreamOrder & {
  provider: string
  provider_checked_at?: Date | string | null
  external_order_id?: string | null
  asaas_pix_qr_id?: string | null
  asaas_pix_local_simulated_at?: Date | string | null
}

function cents(value: number) {
  if (!Number.isFinite(value)) throw new Error('Valor inválido no Asaas.')
  return Math.round(value * 100)
}

const paidStatuses = new Set(['CONFIRMED', 'RECEIVED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REFUND_REQUESTED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'])

export function selectAsaasPayment(payments: AsaasPayment[], order: AsaasOrder) {
  const paidPayments = payments.filter(item => paidStatuses.has(item.status))
  if (paidPayments.length > 1) throw new Error('Checkout com múltiplos pagamentos confirmados.')
  const payment = order.external_order_id
    ? payments.find(item => item.id === order.external_order_id)
    : paidPayments[0] || payments[0] || null
  if (order.external_order_id && !payment) throw new Error('Pagamento do pedido ausente no checkout.')
  return payment
}

export function asaasPaymentState(payment: AsaasPayment | null, order: AsaasOrder) {
  if (!payment) return { paid: false, refunded: 0, disputed: false, status: 'pending' }
  if (
    payment.checkoutSession !== order.session_id ||
    !['PIX', 'CREDIT_CARD'].includes(payment.billingType) ||
    cents(payment.value) !== order.amount ||
    order.external_order_id && order.external_order_id !== payment.id
  ) throw new Error('Cobrança não corresponde ao pedido.')
  const paid = paidStatuses.has(payment.status)
  const refunded = Math.min(order.amount, Math.max(
    payment.status === 'REFUNDED' ? order.amount : 0,
    (payment.refunds || []).filter(refund => refund.status === 'DONE').reduce((sum, refund) => sum + cents(refund.value), 0),
  ))
  const disputed = ['CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'].includes(payment.status)
  const status = ['OVERDUE', 'DELETED', 'CANCELED', 'CREDIT_CARD_CAPTURE_REFUSED'].includes(payment.status) ? 'failed' : 'pending'
  return { paid, refunded, disputed, status }
}

export function asaasPixPaymentState(payment: AsaasPayment | null, order: AsaasOrder) {
  if (!payment) return { paid: false, refunded: 0, disputed: false, status: 'pending' }
  const checks = {
    qrPresent: Boolean(payment.pixQrCodeId),
    qrMatches: Boolean(order.asaas_pix_qr_id && payment.pixQrCodeId === order.asaas_pix_qr_id),
    externalPresent: Boolean(payment.externalReference),
    externalMatches: payment.externalReference === order.id,
    pix: payment.billingType === 'PIX',
    amountMatches: cents(payment.value) === order.amount,
    paymentIdMatches: !order.external_order_id || order.external_order_id === payment.id,
  }
  if (!checks.qrMatches || !checks.pix || !checks.amountMatches || !checks.paymentIdMatches) {
    console.error('asaas_pix_detail_mismatch', checks)
    throw new Error('Pagamento Pix não corresponde ao pedido.')
  }
  const paid = paidStatuses.has(payment.status)
  const refunded = Math.min(order.amount, Math.max(
    payment.status === 'REFUNDED' ? order.amount : 0,
    (payment.refunds || []).filter(refund => refund.status === 'DONE').reduce((sum, refund) => sum + cents(refund.value), 0),
  ))
  const disputed = ['CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'].includes(payment.status)
  const status = ['OVERDUE', 'DELETED', 'CANCELED'].includes(payment.status) ? 'failed' : 'pending'
  return { paid, refunded, disputed, status }
}

export async function reconcileAsaasPix(orderId: string, expectedUser?: string, force = false) {
  const sql = getDb()
  const [order] = (await sql`SELECT * FROM dream_orders WHERE id=${orderId}::uuid AND provider='asaas' AND mode=${billingMode()} AND asaas_pix_qr_id IS NOT NULL`) as AsaasOrder[]
  if (!order) return null
  if (expectedUser && order.user_id !== expectedUser) throw new Error('Compra não encontrada.')
  if (order.asaas_pix_local_simulated_at) return {
    id: order.id, status: order.status, credits: Number((order as AsaasOrder & { credited: number }).credited),
    amount: Number(order.amount), mode: order.mode,
    source: order.preview_id ? 'comecar' as const : 'account' as const,
    accessEmailSent: Boolean(order.access_email_sent_at),
  }
  if (!force && order.provider_checked_at && Date.now() - new Date(order.provider_checked_at).getTime() < 15_000)
    return { id: order.id, status: order.status, credits: Number((order as AsaasOrder & { credited: number }).credited), amount: Number(order.amount), mode: order.mode, source: order.price_id.includes(':comecar:') || order.preview_id ? 'comecar' as const : 'account' as const, accessEmailSent: Boolean(order.access_email_sent_at) }
  const revision = Date.now()
  const listed = await getAsaasPixPayments(String(order.asaas_pix_qr_id))
  const payments = await Promise.all(listed.map(item => getAsaasPayment(item.id)))
  const payment = selectAsaasPayment(payments, order)
  const state = asaasPixPaymentState(payment, order)
  const [simulation] = await sql`SELECT asaas_pix_local_simulated_at,status,credited,access_email_sent_at
    FROM dream_orders WHERE id=${order.id}::uuid`
  if (simulation?.asaas_pix_local_simulated_at) return {
    id: order.id, status: String(simulation.status), credits: Number(simulation.credited), amount: Number(order.amount),
    mode: order.mode, source: order.preview_id ? 'comecar' as const : 'account' as const,
    accessEmailSent: Boolean(simulation.access_email_sent_at),
  }
  if (payment) await sql`UPDATE dream_orders SET external_order_id=COALESCE(external_order_id,${state.paid ? payment.id : null}),provider_checked_at=now()
    WHERE id=${order.id}::uuid AND (external_order_id IS NULL OR external_order_id=${payment.id})`
  else await sql`UPDATE dream_orders SET provider_checked_at=now() WHERE id=${order.id}::uuid`
  return fulfillOrder({
    order,
    ...state,
    revision,
    pendingStatus: ['expired', 'failed'].includes(order.status) && !state.paid ? order.status : state.status,
    paidEmail: state.paid && order.preview_id ? String(order.guest_email || '') : undefined,
    bump: Boolean(order.preview_id && order.credits === 3),
    source: order.price_id.includes(':comecar:') || order.preview_id ? 'comecar' : 'account',
  })
}

export async function simulateAsaasPixLocally(orderId: string) {
  const sql = getDb()
  const [order] = (await sql`SELECT * FROM dream_orders WHERE id=${orderId}::uuid AND provider='asaas'
    AND mode='test' AND asaas_pix_qr_id IS NOT NULL AND session_id IS NULL`) as AsaasOrder[]
  if (!order || (order.status !== 'pending' && !order.asaas_pix_local_simulated_at))
    throw new Error('Este pedido não está disponível para simulação.')
  if (!order.asaas_pix_local_simulated_at) {
    const [marked] = await sql`UPDATE dream_orders SET asaas_pix_local_simulated_at=now()
      WHERE id=${orderId}::uuid AND asaas_pix_local_simulated_at IS NULL AND status='pending'
        AND asaas_pix_expires_at>now() RETURNING id`
    if (!marked) throw new Error('O QR Code expirou. Gere um novo Pix de teste.')
  }
  return fulfillOrder({
    order, paid: true, refunded: 0, disputed: false, revision: Date.now(), pendingStatus: 'pending',
    paidEmail: order.preview_id ? String(order.guest_email || '') : undefined,
    bump: Boolean(order.preview_id && order.credits === 3),
    source: order.preview_id ? 'comecar' : 'account',
  })
}

// O navegador consulta o banco; uma leitura remota esporádica cobre retornos sem webhook local.
export async function reconcileAsaasCheckout(id: string, expectedUser?: string, force = false) {
  const sql = getDb()
  const [order] = (await sql`SELECT * FROM dream_orders WHERE session_id=${id} AND provider='asaas' AND mode=${billingMode()}`) as AsaasOrder[]
  if (!order) return null
  if (expectedUser && order.user_id !== expectedUser) throw new Error('Compra não encontrada.')
  if (!force && order.provider_checked_at && Date.now() - new Date(order.provider_checked_at).getTime() < 15_000) {
    return { id: order.id, status: order.status, credits: Number((order as AsaasOrder & { credited: number }).credited), amount: Number(order.amount), mode: order.mode, source: order.price_id.includes(':comecar:') || order.preview_id ? 'comecar' as const : 'account' as const, accessEmailSent: Boolean(order.access_email_sent_at) }
  }
  const revision = Date.now()
  const listed = await getAsaasCheckoutPayments(id)
  const payments = await Promise.all(listed.map(item => getAsaasPayment(item.id)))
  const payment = selectAsaasPayment(payments, order)
  const state = asaasPaymentState(payment, order)
  if (payment) await sql`UPDATE dream_orders SET external_order_id=COALESCE(external_order_id,${state.paid ? payment.id : null}),provider_checked_at=now()
    WHERE id=${order.id}::uuid AND (external_order_id IS NULL OR external_order_id=${payment.id})`
  else await sql`UPDATE dream_orders SET provider_checked_at=now() WHERE id=${order.id}::uuid`
  const paidEmail = state.paid && order.preview_id && payment?.customer
    ? await getAsaasCustomerEmail(payment.customer)
    : undefined
  return fulfillOrder({
    order,
    ...state,
    revision,
    pendingStatus: ['expired', 'failed'].includes(order.status) && !state.paid ? order.status : state.status,
    paidEmail,
    bump: Boolean(order.preview_id && order.credits === 3),
    source: order.price_id.includes(':comecar:') || order.preview_id ? 'comecar' : 'account',
  })
}

export async function processAsaasEvent(payload: unknown) {
  if (!payload || typeof payload !== 'object') return
  const event = payload as { event?: string; checkout?: { id?: string }; payment?: { id?: string; checkoutSession?: string } }
  if (event.event?.startsWith('CHECKOUT_') && event.checkout?.id) {
    if (event.event === 'CHECKOUT_CANCELED' || event.event === 'CHECKOUT_EXPIRED') {
      await getDb()`UPDATE dream_orders SET status=${event.event === 'CHECKOUT_EXPIRED' ? 'expired' : 'failed'}
        WHERE session_id=${event.checkout.id} AND provider='asaas' AND mode=${billingMode()} AND paid=false AND status='pending'`
    } else if (event.event === 'CHECKOUT_PAID') {
      await reconcileAsaasCheckout(event.checkout.id, undefined, true)
    }
  } else if (event.event?.startsWith('PAYMENT_') && event.payment?.id) {
    const payment = await getAsaasPayment(event.payment.id)
    const checkoutId = payment.checkoutSession || event.payment.checkoutSession
    if (checkoutId) await reconcileAsaasCheckout(checkoutId, undefined, true)
    else if (payment.pixQrCodeId) {
      const [order] = await getDb()`SELECT id FROM dream_orders WHERE asaas_pix_qr_id=${payment.pixQrCodeId} AND provider='asaas' AND mode=${billingMode()}`
      if (order) await reconcileAsaasPix(String(order.id), undefined, true)
    }
  }
}
