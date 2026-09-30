import { NextResponse } from 'next/server'
import { validAsaasWebhookToken } from '@/lib/asaas'
import { processAsaasEvent } from '@/lib/asaas-payments'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!validAsaasWebhookToken(request.headers.get('asaas-access-token')))
    return new Response(null, { status: 401 })
  let event: unknown
  try { event = await request.json() }
  catch { return new Response(null, { status: 400 }) }
  try {
    await processAsaasEvent(event)
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('asaas_webhook_failed', { reason: error instanceof Error ? error.message : 'UnknownError' })
    return new Response(null, { status: 500 })
  }
}
