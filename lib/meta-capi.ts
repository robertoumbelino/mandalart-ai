import 'server-only'
import { createHash } from 'node:crypto'
import { billingMode, billingOrigin } from '@/lib/stripe'

export async function sendMetaPurchase(order: { id: string; email: string; amount: number; consent: boolean }) {
  if (!order.consent) return
  if (billingMode() !== 'live') return
  const token = process.env.META_CAPI_ACCESS_TOKEN
  const version = process.env.META_CAPI_API_VERSION
  if (!token || !version) return
  const pixelId = process.env.META_PIXEL_ID || '975897138891298'
  const emailHash = createHash('sha256').update(order.email.trim().toLowerCase()).digest('hex')
  const response = await fetch(`https://graph.facebook.com/${version}/${pixelId}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [{
      event_name: 'Purchase', event_time: Math.floor(Date.now() / 1000),
      event_id: `purchase-${order.id}`, action_source: 'website',
      event_source_url: `${billingOrigin()}/compra`,
      user_data: { em: [emailHash] },
      custom_data: { currency: 'BRL', value: order.amount / 100, order_id: order.id },
    }] }),
  })
  if (!response.ok) throw new Error(`Meta CAPI HTTP ${response.status}`)
}
