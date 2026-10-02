'use server'

import { getDb } from '@/lib/db'
import { kiwifyLocalDemoEnabled, processKiwifyEvent } from '@/lib/kiwify'
import { getPreviewSession } from '@/lib/onboarding-server'
import { idSchema } from '@/lib/validation'
import { z } from 'zod'

async function demoOrder(rawOrderId: string) {
  if (!kiwifyLocalDemoEnabled()) throw new Error('Simulação disponível somente no ambiente local de testes.')
  const orderId = idSchema.parse(rawOrderId)
  const sessionId = await getPreviewSession()
  const [order] = await getDb()`SELECT o.id,o.credits,o.amount,o.price_id,o.status
    FROM dream_orders o JOIN onboarding_previews p ON p.id=o.preview_id
    WHERE o.id=${orderId}::uuid AND o.provider='kiwify' AND o.mode='test'
      AND p.session_id=${sessionId}::uuid`
  if (!order) throw new Error('Pedido de teste não encontrado neste navegador.')
  return { id: String(order.id), credits: Number(order.credits), amount: Number(order.amount), priceId: String(order.price_id), status: String(order.status) }
}

export async function getKiwifyDemoOrder(rawOrderId: string) {
  const order = await demoOrder(rawOrderId)
  return { id: order.id, credits: order.credits, amount: order.amount, status: order.status }
}

export async function completeKiwifyDemoOrder(rawOrderId: string, rawEmail: string, rawMethod: 'pix' | 'card') {
  const order = await demoOrder(rawOrderId)
  if (order.status !== 'pending') throw new Error('Este pedido de teste já foi concluído.')
  const email = z.email().max(254).parse(rawEmail.trim().toLowerCase())
  const method = z.enum(['pix', 'card']).parse(rawMethod)
  const result = await processKiwifyEvent({
    order_id: order.id,
    order_status: 'paid',
    webhook_event_type: 'order_approved',
    Product: { product_id: process.env.KIWIFY_PRODUCT_ID },
    Customer: { email },
    payment_method: method === 'pix' ? 'pix' : 'credit_card',
    Commissions: {
      charge_amount: order.amount,
      currency: 'BRL',
      product_base_price: order.amount,
      product_base_price_currency: 'BRL',
    },
    TrackingParameters: { sck: order.id },
    checkout_link: order.priceId,
  })
  if (result !== 'processed') throw new Error('Não foi possível concluir a simulação.')
  return { completed: true }
}
