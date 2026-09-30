import 'server-only'
import type Stripe from 'stripe'
import { getDb } from '@/lib/db'
import { getStripe, stripeMode } from '@/lib/stripe'
import { DREAM_PACKS, type DreamPack } from '@/lib/dream-packs'
import { fulfillOrder } from '@/lib/order-fulfillment'

export type DreamOrder = {
  id: string
  user_id: string | null
  mode: 'test' | 'live'
  credits: DreamPack
  amount: number
  price_id: string
  session_id: string | null
  status: string
  attribution?: unknown
  guest_email?: string | null
  lead_id?: string | null
  preview_id?: string | null
  bump_price_id?: string | null
  access_email_sent_at?: string | null
  purchase_confirmed_at?: Date | string
  product_event_sent_at?: Date | string | null
  analytics_distinct_id?: string | null
  marketing_consent?: boolean
  journey_version?: string
  browser_access_granted?: boolean
}
export function verifyCheckout(
  session: Stripe.Checkout.Session,
  order: DreamOrder,
  lines: Stripe.LineItem[],
) {
  const pack = DREAM_PACKS[order.credits]
  const guest = Boolean(order.preview_id)
  const baseLine = lines.find(line => line.price?.id === order.price_id)
  const bumpLine = lines.find(line => line.price?.id === order.bump_price_id)
  const bump = guest && Boolean(bumpLine)
  const amount = guest ? 3700 + (bump ? 6200 : 0) : order.amount
  if (
    !pack ||
    session.livemode !== (order.mode === 'live') ||
    order.mode !== stripeMode() ||
    session.mode !== 'payment' ||
    session.metadata?.app !== 'mandalart' ||
    session.metadata.order_id !== order.id ||
    session.client_reference_id !== (guest ? order.id : order.user_id) ||
    (order.session_id && order.session_id !== session.id) ||
    session.currency !== 'brl' ||
    session.amount_total !== amount ||
    (guest ? (lines.length !== (bump ? 2 : 1) || !baseLine || baseLine.amount_total !== 3700 || baseLine.quantity !== 1 || (bump && (!bumpLine || bumpLine.amount_total !== 6200 || bumpLine.quantity !== 1))) : (lines.length !== 1 || lines[0].quantity !== 1 || lines[0].price?.id !== order.price_id || lines[0].amount_total !== order.amount))
  ) {
    throw new Error('Checkout não corresponde ao pedido.')
  }
  return { amount, credits: bump ? 3 : 1, bump }
}

// Usado tanto pelo webhook assinado quanto pela recuperação autenticada do retorno.
export async function reconcileCheckout(
  sessionId: string,
  expectedUser?: string,
) {
  const revision = Date.now()
  const sql = getDb()
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.metadata?.app !== 'mandalart') return null
  const orderId = session.metadata.order_id
  if (!orderId || !/^[a-f0-9-]{36}$/i.test(orderId)) return null
  const [order] =
    (await sql`SELECT * FROM dream_orders WHERE id=${orderId}::uuid`) as DreamOrder[]
  if (!order) return null
  if (expectedUser && order.user_id !== expectedUser)
    throw new Error('Compra não encontrada.')
  const lines = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 3,
  })
  const checkout = verifyCheckout(session, order, lines.data)
  if (order.preview_id) {
    await sql`UPDATE dream_orders SET amount=${checkout.amount},credits=${checkout.credits} WHERE id=${order.id}::uuid AND paid=false`
    order.amount = checkout.amount
    order.credits = checkout.credits as DreamPack
  }
  const intentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id
  // Vincula antes de consultar a cobrança, para não perder um estorno concorrente.
  await sql`UPDATE dream_orders SET session_id=${session.id},payment_intent_id=COALESCE(payment_intent_id,${intentId || null}) WHERE id=${order.id}::uuid`
  let paid = false
  let refunded = 0
  let disputed = false
  let failed = false
  if (intentId) {
    const intent = await stripe.paymentIntents.retrieve(intentId, {
      expand: ['latest_charge'],
    })
    failed =
      intent.status === 'canceled' ||
      (session.status === 'complete' &&
        intent.status === 'requires_payment_method')
    const charge =
      typeof intent.latest_charge === 'object' ? intent.latest_charge : null
    paid =
      session.payment_status === 'paid' &&
      intent.status === 'succeeded' &&
      intent.currency === 'brl' &&
      intent.amount_received === order.amount
    if (charge) {
      refunded = charge.amount_refunded
      if (charge.disputed) {
        const disputes = await stripe.disputes.list({
          charge: charge.id,
          limit: 10,
        })
        disputed = disputes.data.some(
          (dispute) =>
            !['won', 'warning_closed', 'prevented'].includes(dispute.status),
        )
      }
    }
  }
  return fulfillOrder({
    order, paid, refunded, disputed, revision,
    pendingStatus: session.status === 'expired' ? 'expired' : failed ? 'failed' : 'pending',
    paidEmail: session.customer_details?.email || session.customer_email || '',
    bump: checkout.bump,
    source: session.metadata.source === 'comecar' ? 'comecar' : 'account',
  })
}

export async function processStripeEvent(event: Stripe.Event) {
  if (event.livemode !== (stripeMode() === 'live'))
    throw new Error('Ambiente do evento inválido.')
  if (
    [
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      'checkout.session.expired',
    ].includes(event.type)
  ) {
    await reconcileCheckout((event.data.object as Stripe.Checkout.Session).id)
    return
  }
  if (
    event.type === 'charge.refunded' ||
    event.type.startsWith('charge.dispute.')
  ) {
    const object = event.data.object as Stripe.Charge | Stripe.Dispute
    const intentId =
      typeof object.payment_intent === 'string'
        ? object.payment_intent
        : object.payment_intent?.id
    if (!intentId) return
    const [order] =
      await getDb()`SELECT session_id FROM dream_orders WHERE payment_intent_id=${intentId} AND mode=${stripeMode()}`
    if (order?.session_id) await reconcileCheckout(String(order.session_id))
  }
}
