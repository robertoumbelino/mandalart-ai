import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/actions/auth'
import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'
import { reconcileAsaasPix, simulateAsaasPixLocally } from '@/lib/asaas-payments'
import { localPixSimulationEnabled } from '@/lib/asaas-pix-local-simulation'
import { billingMode } from '@/lib/stripe'
import { idSchema } from '@/lib/validation'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const parsed = idSchema.safeParse(new URL(request.url).searchParams.get('order_id'))
  if (!parsed.success) return new Response(null, { status: 400 })
  const sql = getDb()
  const [order] = await sql`SELECT o.id,o.user_id,o.status,o.amount,o.credits,o.guest_email,o.preview_id,o.journey_version,
      o.asaas_pix_qr_id,o.asaas_pix_payload,o.asaas_pix_image,o.asaas_pix_expires_at,p.session_id AS preview_session
    FROM dream_orders o LEFT JOIN onboarding_previews p ON p.id=o.preview_id
    WHERE o.id=${parsed.data}::uuid AND o.provider='asaas' AND o.mode=${billingMode()} AND o.asaas_pix_qr_id IS NOT NULL`
  if (!order) return new Response(null, { status: 404 })
  if (order.preview_id) {
    if (order.preview_session !== await getPreviewSession()) return new Response(null, { status: 404 })
  } else {
    const user = await getCurrentUser()
    if (!user || user.id !== order.user_id) return new Response(null, { status: 404 })
  }
  if (order.status === 'pending') await reconcileAsaasPix(parsed.data)
  const [fresh] = await sql`SELECT status,access_email_sent_at,asaas_pix_local_simulated_at FROM dream_orders WHERE id=${parsed.data}::uuid`
  const expired = new Date(order.asaas_pix_expires_at as string).getTime() <= Date.now()
  const status = fresh.status === 'pending' && expired ? 'expired' : fresh.status
  return NextResponse.json({
    journeyVersion: order.journey_version || undefined, id: String(order.id), status: String(status), amount: Number(order.amount), credits: Number(order.credits),
    email: order.preview_id ? String(order.guest_email || '') : undefined,
    source: order.preview_id ? 'comecar' : 'account',
    expiresAt: new Date(order.asaas_pix_expires_at as string).toISOString(),
    accessEmailSent: Boolean(fresh.access_email_sent_at),
    simulated: Boolean(fresh.asaas_pix_local_simulated_at),
    canSimulate: status === 'pending' && !expired && localPixSimulationEnabled(request),
    ...(status === 'pending' ? { payload: String(order.asaas_pix_payload), image: String(order.asaas_pix_image) } : {}),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  if (!localPixSimulationEnabled(request, true)) return new Response(null, { status: 404 })
  const parsed = idSchema.safeParse(new URL(request.url).searchParams.get('order_id'))
  if (!parsed.success) return new Response(null, { status: 400 })
  const sql = getDb()
  const [order] = await sql`SELECT o.id,o.user_id,o.preview_id,p.session_id AS preview_session
    FROM dream_orders o LEFT JOIN onboarding_previews p ON p.id=o.preview_id
    WHERE o.id=${parsed.data}::uuid AND o.provider='asaas' AND o.mode='test' AND o.asaas_pix_qr_id IS NOT NULL`
  if (!order) return new Response(null, { status: 404 })
  if (order.preview_id) {
    if (order.preview_session !== await getPreviewSession()) return new Response(null, { status: 404 })
  } else {
    const user = await getCurrentUser()
    if (!user || user.id !== order.user_id) return new Response(null, { status: 404 })
  }
  try {
    const result = await simulateAsaasPixLocally(parsed.data)
    return NextResponse.json({ status: result.status, simulated: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Não foi possível simular o pagamento.' }, { status: 409 })
  }
}
