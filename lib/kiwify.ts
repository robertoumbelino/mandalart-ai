import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { getDb } from '@/lib/db'
import { DREAM_PACKS, type DreamPack } from '@/lib/dream-packs'
import { billingMode } from '@/lib/stripe'
import { idSchema } from '@/lib/validation'

type KiwifyEvent = {
  order_id?: unknown
  order_status?: unknown
  webhook_event_type?: unknown
  Product?: { product_id?: unknown }
  Commissions?: {
    charge_amount?: unknown
    currency?: unknown
    product_base_price?: unknown
    product_base_price_currency?: unknown
  }
  TrackingParameters?: { sck?: unknown }
  checkout_link?: unknown
}

export function kiwifyConfigured() {
  return Boolean(
    process.env.KIWIFY_CHECKOUT_ONE &&
      process.env.KIWIFY_CHECKOUT_THREE &&
      process.env.KIWIFY_PRODUCT_ID &&
      process.env.KIWIFY_WEBHOOK_TOKEN,
  )
}

export function kiwifyOnboardingEnabled() {
  return (
    process.env.KIWIFY_ONBOARDING_ENABLED === 'true' &&
    kiwifyConfigured() &&
    billingMode() === 'live'
  )
}

export function verifyKiwifySignature(body: string, signature: string | null) {
  const token = process.env.KIWIFY_WEBHOOK_TOKEN
  if (!token || !signature || !/^[a-f0-9]{40}$/i.test(signature)) return false
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return false
  }
  const expected = createHmac('sha1', token)
    .update(JSON.stringify(payload))
    .digest('hex')
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
}

function checkoutCode(pack: DreamPack) {
  const configured = process.env[
    pack === 1 ? 'KIWIFY_CHECKOUT_ONE' : 'KIWIFY_CHECKOUT_THREE'
  ]
  if (!configured) throw new Error('Oferta da Kiwify não configurada.')
  const url = new URL(configured)
  if (url.protocol !== 'https:' || url.hostname !== 'pay.kiwify.com.br')
    throw new Error('Oferta da Kiwify inválida.')
  return url.pathname.slice(1).replace(/\/$/, '')
}

export function validateKiwifyEvent(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  const event = raw as KiwifyEvent
  const id = event.TrackingParameters?.sck
  if (typeof id !== 'string' || !idSchema.safeParse(id).success) return null
  if (
    !process.env.KIWIFY_PRODUCT_ID ||
    typeof event.order_id !== 'string' ||
    !idSchema.safeParse(event.order_id).success ||
    event.Product?.product_id !== process.env.KIWIFY_PRODUCT_ID ||
    event.Commissions?.currency !== 'BRL' ||
    event.Commissions.product_base_price_currency !== 'BRL'
  ) return null

  const status = event.webhook_event_type
  if (!['order_approved', 'order_refunded', 'chargeback'].includes(String(status)))
    return null
  if (status === 'order_approved' && event.order_status !== 'paid') return null

  const amount = Number(event.Commissions.charge_amount)
  const basePrice = Number(event.Commissions.product_base_price)
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(basePrice)) return null

  return {
    id,
    externalOrderId: event.order_id,
    eventType: status as 'order_approved' | 'order_refunded' | 'chargeback',
    amount,
    basePrice,
    checkoutLink: event.checkout_link,
  }
}

export async function processKiwifyEvent(raw: unknown) {
  const event = validateKiwifyEvent(raw)
  if (!event) return 'ignored' as const

  const sql = getDb()
  const [order] = await sql`
    SELECT id, mode, provider, credits, amount, price_id, external_order_id
    FROM dream_orders WHERE id=${event.id}::uuid
  `
  if (!order) return 'ignored' as const
  const credits = Number(order.credits) as DreamPack
  if (
    order.provider !== 'kiwify' ||
    order.mode !== billingMode() ||
    !DREAM_PACKS[credits] ||
    Number(order.amount) !== DREAM_PACKS[credits].amount ||
    event.amount !== Number(order.amount) ||
    event.basePrice !== Number(order.amount) ||
    event.checkoutLink !== checkoutCode(credits) ||
    order.price_id !== event.checkoutLink ||
    (order.external_order_id && order.external_order_id !== event.externalOrderId)
  ) {
    throw new Error('Evento Kiwify não corresponde ao pedido.')
  }

  const linked = await sql`
    UPDATE dream_orders SET external_order_id=${event.externalOrderId}
    WHERE id=${event.id}::uuid AND (external_order_id IS NULL OR external_order_id=${event.externalOrderId})
    RETURNING id
  `
  if (linked.length !== 1)
    throw new Error('Venda Kiwify vinculada a outro pedido.')
  const paid = event.eventType === 'order_approved'
  const refunded = event.eventType === 'order_refunded' ? Number(order.amount) : 0
  const disputed = event.eventType === 'chargeback'
  await sql`
    SELECT dream_reconcile_order(
      ${event.id}::uuid, ${paid}, ${refunded}, ${disputed},
      ${disputed ? Date.now() : 0}::bigint, 'pending'
    )
  `
  return 'processed' as const
}
