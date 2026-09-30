'use server'

import { getCurrentUser } from '@/actions/auth'
import { getDb } from '@/lib/db'
import { reconcileCheckout } from '@/lib/payments'
import { billingMode, getStripe } from '@/lib/stripe'
import { idSchema } from '@/lib/validation'
import { refundAsaasPayment } from '@/lib/asaas'
import { reconcileAsaasCheckout, reconcileAsaasPix } from '@/lib/asaas-payments'

type RefundableOrder = {
  id: string
  amount: number
  credits: number
  created_at: string
  payment_intent_id: string | null
  external_order_id: string | null
  asaas_pix_qr_id: string | null
  provider: string
  session_id: string | null
  status: string
  paid_at: string
}

type PurchaseRow = {
  id: string
  amount: number
  credits: number
  provider: string
  payment_method: string | null
  status: string
  refunded: number
  created_at: string
  paid_at: string | null
  refund_requested_at: string | null
  external_order_id: string | null
  asaas_pix_qr_id: string | null
  session_id: string | null
  payment_intent_id: string | null
}

export async function getPurchaseHistory() {
  const user = await getCurrentUser()
  if (!user) return null
  const rows = await getDb()`
    SELECT orders.id, orders.amount, orders.credits, orders.provider,
      orders.payment_method, orders.status, orders.refunded, orders.created_at, payment.paid_at,
      orders.refund_requested_at, orders.external_order_id,
      orders.asaas_pix_qr_id, orders.session_id, orders.payment_intent_id
    FROM dream_orders orders
    LEFT JOIN LATERAL (
      SELECT created_at AS paid_at FROM dream_credit_ledger
      WHERE reference_id=orders.id AND mode=orders.mode AND reason='purchase'
      ORDER BY created_at ASC LIMIT 1
    ) payment ON true
    WHERE orders.user_id=${user.id} AND orders.mode=${billingMode()} AND orders.paid=true
    ORDER BY COALESCE(payment.paid_at, orders.created_at) DESC
  ` as PurchaseRow[]
  const now = Date.now()
  return rows.map((row) => {
    const paidAt = row.paid_at ? new Date(row.paid_at).toISOString() : null
    const guaranteeEndsAt = paidAt ? new Date(new Date(paidAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : null
    const refundable = row.provider === 'asaas'
      ? Boolean(row.external_order_id && (row.asaas_pix_qr_id || row.session_id))
      : row.provider === 'stripe' && Boolean(row.payment_intent_id && row.session_id)
    return {
      id: String(row.id),
      amount: Number(row.amount),
      credits: Number(row.credits),
      provider: String(row.provider),
      method: row.payment_method || (row.asaas_pix_qr_id ? 'PIX' : null),
      status: String(row.status),
      refunded: Number(row.refunded),
      paidAt,
      createdAt: new Date(row.created_at).toISOString(),
      guaranteeEndsAt,
      withinGuarantee: Boolean(guaranteeEndsAt && now <= new Date(guaranteeEndsAt).getTime()),
      refundRequested: Boolean(row.refund_requested_at),
      canRefund: row.status === 'paid' && !row.refund_requested_at && Boolean(paidAt) &&
        now <= new Date(guaranteeEndsAt!).getTime() && refundable,
    }
  })
}

export async function requestDreamRefund(rawId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Entre na sua conta para solicitar o reembolso.')
  const id = idSchema.parse(rawId)
  const [order] = await getDb()`
    SELECT orders.id, orders.amount, orders.credits, payment.paid_at,
      orders.payment_intent_id, orders.external_order_id, orders.asaas_pix_qr_id,
      orders.session_id, orders.status, orders.provider
    FROM dream_orders orders
    JOIN LATERAL (
      SELECT created_at AS paid_at FROM dream_credit_ledger
      WHERE reference_id=orders.id AND mode=orders.mode AND reason='purchase'
      ORDER BY created_at ASC LIMIT 1
    ) payment ON true
    WHERE orders.id=${id}::uuid AND orders.user_id=${user.id} AND orders.mode=${billingMode()}
      AND orders.provider IN ('stripe','asaas') AND orders.refund_requested_at IS NULL
  ` as RefundableOrder[]
  if (!order) throw new Error('Compra não encontrada nesta conta.')
  if (order.status !== 'paid') throw new Error('Esta compra já foi reembolsada ou está em análise.')
  if (Date.now() - new Date(order.paid_at).getTime() > 7 * 24 * 60 * 60 * 1000)
    throw new Error('O prazo de 7 dias desta compra terminou.')
  if ((order.provider === 'stripe' && (!order.session_id || !order.payment_intent_id)) ||
    (order.provider === 'asaas' && (!order.external_order_id || (!order.session_id && !order.asaas_pix_qr_id))))
    throw new Error('Ainda estamos conferindo o pagamento. Tente novamente em instantes.')

  if (order.provider === 'asaas') {
    const reconcile = () => order.asaas_pix_qr_id
      ? reconcileAsaasPix(id, user.id, true)
      : reconcileAsaasCheckout(order.session_id!, user.id, true)
    await reconcile()
    const [claim] = await getDb()`UPDATE dream_orders SET refund_requested_at=now()
      WHERE id=${id}::uuid AND status='paid' AND refund_requested_at IS NULL RETURNING id`
    if (!claim) throw new Error('Esta compra já foi reembolsada ou está em análise.')
    try {
      await refundAsaasPayment(order.external_order_id!)
    } catch (error) {
      await getDb()`UPDATE dream_orders SET refund_requested_at=NULL WHERE id=${id}::uuid`
      throw error
    }
    try { await reconcile() }
    catch { /* O webhook do Asaas também reconcilia o estorno. */ }
    return { accepted: true }
  }

  await getStripe().refunds.create(
    {
      payment_intent: order.payment_intent_id,
      reason: 'requested_by_customer',
      metadata: { app: 'mandalart', order_id: id, source: 'seven_day_guarantee' },
    },
    { idempotencyKey: `mandalart-guarantee-${id}` },
  )
  await getDb()`UPDATE dream_orders SET refund_requested_at=COALESCE(refund_requested_at,now())
    WHERE id=${id}::uuid AND user_id=${user.id}`
  try {
    await reconcileCheckout(order.session_id, user.id)
  } catch {
    // The signed Stripe webhook also reconciles the credit balance.
  }
  return { accepted: true }
}
