import { Resend } from 'resend'
import { forwardInboundEmail } from '@/lib/inbound-email'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const secret = process.env.RESEND_RECEIVING_WEBHOOK_SECRET
  if (!secret) return new Response('Not configured', { status: 503 })
  const body = await request.text()
  if (body.length > 100_000) return new Response('Payload too large', { status: 413 })
  let event
  try {
    event = new Resend('re_webhook_verification').webhooks.verify({
      payload: body,
      headers: {
        id: request.headers.get('svix-id') || '',
        timestamp: request.headers.get('svix-timestamp') || '',
        signature: request.headers.get('svix-signature') || '',
      },
      webhookSecret: secret,
    })
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }
  if (event.type !== 'email.received') return new Response('ignored')
  try {
    return new Response(await forwardInboundEmail(event))
  } catch {
    console.error('inbound_email_forward_failed', { emailId: event.data.email_id })
    return new Response('Forwarding failed', { status: 500 })
  }
}
