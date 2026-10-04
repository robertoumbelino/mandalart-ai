import { getCurrentUser } from '@/actions/auth'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'
import { reconcileCheckout } from '@/lib/payments'
import { registrationPending } from '@/lib/account-registration'
import { getDream, answersSchema } from '@/lib/onboarding'
import { salesAnswersSchema } from '@/lib/sales-journey'
import { billingMode } from '@/lib/stripe'
import { reconcileAsaasCheckout, reconcileAsaasPix } from '@/lib/asaas-payments'
import { idSchema } from '@/lib/validation'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const sessionId = params.get('session_id') || ''
  const orderId = params.get('order_id') || ''
  const provider = params.get('provider') === 'kiwify' ? 'kiwify' : 'asaas'
  const parsedOrderId = idSchema.safeParse(orderId)
  if (provider === 'kiwify' && !parsedOrderId.success) return new Response(null, { status: 400 })
  if (!parsedOrderId.success && !/^cs_(test_|live_)?[A-Za-z0-9]{10,250}$/.test(sessionId)) return new Response(null, { status: 400 })
  const previewSession = await getPreviewSession()
  const sql = getDb()
  const [order] = parsedOrderId.success
    ? await sql`SELECT o.id,o.user_id,o.status,o.amount,o.credits,o.preview_id,o.journey_version,p.answers
        FROM dream_orders o JOIN onboarding_previews p ON p.id=o.preview_id
        WHERE o.id=${parsedOrderId.data}::uuid AND o.provider=${provider} AND o.mode=${billingMode()} AND p.session_id=${previewSession}::uuid`
    : await sql`SELECT o.id,o.user_id,o.status,o.amount,o.credits,o.preview_id,o.journey_version,p.answers
        FROM dream_orders o JOIN onboarding_previews p ON p.id=o.preview_id
        WHERE o.session_id=${sessionId} AND o.provider='stripe' AND o.mode=${billingMode()} AND p.session_id=${previewSession}::uuid`
  if (!order) return new Response(null, { status: 404 })
  if (parsedOrderId.success && provider === 'asaas') {
    const [checkout] = await sql`SELECT session_id,asaas_pix_qr_id FROM dream_orders WHERE id=${parsedOrderId.data}::uuid`
    if (checkout?.asaas_pix_qr_id) await reconcileAsaasPix(parsedOrderId.data)
    else if (checkout?.session_id) await reconcileAsaasCheckout(String(checkout.session_id))
  } else if (!parsedOrderId.success) await reconcileCheckout(sessionId)
  const [fresh] = await sql`SELECT user_id,status,amount,credits,access_email_sent_at,asaas_pix_local_simulated_at FROM dream_orders WHERE id=${order.id}::uuid`
  if (fresh.status !== 'paid' || !fresh.user_id)
    return NextResponse.json({ journeyVersion: order.journey_version, status: ['expired', 'failed'].includes(String(fresh.status)) ? fresh.status : 'pending' }, { headers: { 'Cache-Control': 'private, no-store' } })
  const [currentUser, registrationRequired] = await Promise.all([getCurrentUser(), registrationPending(String(fresh.user_id))])
  return NextResponse.json({ status: 'paid', journeyVersion: order.journey_version, mode: billingMode(), simulated: Boolean(fresh.asaas_pix_local_simulated_at) || (provider === 'kiwify' && billingMode() === 'test'), previewId: String(order.preview_id), dream: getDream(salesAnswersSchema.safeParse(order.answers).success ? salesAnswersSchema.parse(order.answers) : answersSchema.parse(order.answers)), id: String(order.id), amount: Number(fresh.amount), credits: Number(fresh.credits), accessEmailSent: Boolean(fresh.access_email_sent_at), registrationRequired, authenticated: currentUser?.id === fresh.user_id }, { headers: { 'Cache-Control': 'private, no-store' } })
}
