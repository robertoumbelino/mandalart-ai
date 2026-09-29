import { getCurrentUser } from '@/actions/auth'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'
import { reconcileCheckout } from '@/lib/payments'
import { registrationPending } from '@/lib/account-registration'
import { getDream, answersSchema } from '@/lib/onboarding'
import { billingMode } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id') || ''
  if (!/^cs_(test_|live_)?[A-Za-z0-9]{10,250}$/.test(sessionId)) return new Response(null, { status: 400 })
  const previewSession = await getPreviewSession()
  const sql = getDb()
  const [order] = await sql`SELECT o.id,o.user_id,o.status,o.amount,o.credits,o.preview_id,p.answers
    FROM dream_orders o JOIN onboarding_previews p ON p.id=o.preview_id
    WHERE o.session_id=${sessionId} AND o.mode=${billingMode()} AND p.session_id=${previewSession}::uuid`
  if (!order) return new Response(null, { status: 404 })
  await reconcileCheckout(sessionId)
  const [fresh] = await sql`SELECT user_id,status,amount,credits,access_email_sent_at FROM dream_orders WHERE id=${order.id}::uuid`
  if (fresh.status !== 'paid' || !fresh.user_id)
    return NextResponse.json({ status: ['expired', 'failed'].includes(String(fresh.status)) ? fresh.status : 'pending' }, { headers: { 'Cache-Control': 'private, no-store' } })
  const [currentUser, registrationRequired] = await Promise.all([getCurrentUser(), registrationPending(String(fresh.user_id))])
  return NextResponse.json({ status: 'paid', mode: billingMode(), previewId: String(order.preview_id), dream: getDream(answersSchema.parse(order.answers)), id: String(order.id), amount: Number(fresh.amount), credits: Number(fresh.credits), accessEmailSent: Boolean(fresh.access_email_sent_at), registrationRequired, authenticated: currentUser?.id === fresh.user_id }, { headers: { 'Cache-Control': 'private, no-store' } })
}
