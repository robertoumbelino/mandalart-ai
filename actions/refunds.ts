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

export async function getRefundableOrders() {
  const user = await getCurrentUser()
  if (!user) return null
  const rows = await getDb()`
    SELECT orders.id, orders.amount, orders.credits, payment.paid_at
    FROM dream_orders orders
    JOIN LATERAL (
      SELECT created_at AS paid_at FROM dream_credit_ledger
      WHERE reference_id=orders.id AND mode=orders.mode AND reason='purchase'
      ORDER BY created_at ASC LIMIT 1
    ) payment ON true
    WHERE orders.user_id=${user.id} AND orders.mode=${billingMode()} AND orders.provider IN ('stripe','asaas')
      AND orders.status='paid' AND orders.refund_requested_at IS NULL AND payment.paid_at >= now() - interval '7 days'
    ORDER BY payment.paid_at DESC
  `
  return rows.map((row) => ({
    id: String(row.id),
    amount: Number(row.amount),
    credits: Number(row.credits),
    createdAt: new Date(row.paid_at as string).toISOString(),
  }))
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
  try {
    await reconcileCheckout(order.session_id, user.id)
  } catch {
    // The signed Stripe webhook also reconciles the credit balance.
  }
  return { accepted: true }
}
