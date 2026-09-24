import { getStripe } from '@/lib/stripe'
import { processStripeEvent } from '@/lib/payments'

export const runtime = 'nodejs'
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return new Response('Webhook not configured', { status: 503 })
  const signature = request.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })
  const body = await request.text()
  if (body.length > 1_000_000)
    return new Response('Payload too large', { status: 413 })
  let event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }
  try {
    await processStripeEvent(event)
    return Response.json({ received: true })
  } catch {
    console.error('stripe_webhook_processing_failed', {
      eventId: event.id,
      type: event.type,
    })
    return new Response('Please retry', { status: 500 })
  }
}
