'use server'

import { getCurrentUser } from '@/actions/auth'
import { getDb } from '@/lib/db'
import { reconcileCheckout } from '@/lib/payments'
import { billingMode, getStripe } from '@/lib/stripe'
import { idSchema } from '@/lib/validation'

type RefundableOrder = {
  id: string
  amount: number
  credits: number
  created_at: string
  payment_intent_id: string | null
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
    WHERE orders.user_id=${user.id} AND orders.mode=${billingMode()} AND orders.provider='stripe'
      AND orders.status='paid' AND payment.paid_at >= now() - interval '7 days'
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
      orders.payment_intent_id, orders.session_id, orders.status
    FROM dream_orders orders
    JOIN LATERAL (
      SELECT created_at AS paid_at FROM dream_credit_ledger
      WHERE reference_id=orders.id AND mode=orders.mode AND reason='purchase'
      ORDER BY created_at ASC LIMIT 1
    ) payment ON true
    WHERE orders.id=${id}::uuid AND orders.user_id=${user.id} AND orders.mode=${billingMode()}
      AND orders.provider='stripe'
  ` as RefundableOrder[]
  if (!order) throw new Error('Compra não encontrada nesta conta.')
  if (order.status !== 'paid') throw new Error('Esta compra já foi reembolsada ou está em análise.')
  if (Date.now() - new Date(order.paid_at).getTime() > 7 * 24 * 60 * 60 * 1000)
    throw new Error('O prazo de 7 dias desta compra terminou.')
  if (!order.payment_intent_id || !order.session_id)
    throw new Error('Ainda estamos conferindo o pagamento. Tente novamente em instantes.')

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
