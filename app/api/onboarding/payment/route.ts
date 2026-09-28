import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getPreviewSession } from '@/lib/onboarding-server'
import { reconcileCheckout } from '@/lib/payments'
import { ACCESS_COOKIE, ACCESS_COOKIE_OPTIONS, createPaidBrowserSession } from '@/lib/email-access'
import { billingMode } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id') || ''
  if (!/^cs_(test_|live_)?[A-Za-z0-9]{10,250}$/.test(sessionId)) return new Response(null, { status: 400 })
  const previewSession = await getPreviewSession()
  const sql = getDb()
  const [order] = await sql`SELECT o.id,o.user_id,o.status,o.amount,o.credits
    FROM dream_orders o JOIN onboarding_leads l ON l.id=o.lead_id
    WHERE o.session_id=${sessionId} AND o.mode=${billingMode()} AND l.session_id=${previewSession}::uuid`
  if (!order) return new Response(null, { status: 404 })
  await reconcileCheckout(sessionId)
  const [fresh] = await sql`SELECT user_id,status,amount,credits,access_email_sent_at,browser_access_granted FROM dream_orders WHERE id=${order.id}::uuid`
  if (fresh.status !== 'paid' || !fresh.user_id)
    return NextResponse.json({ status: fresh.status === 'expired' ? 'expired' : 'pending' }, { headers: { 'Cache-Control': 'private, no-store' } })
  if (!fresh.browser_access_granted)
    return NextResponse.json({ status: 'paid', id: String(order.id), amount: Number(fresh.amount), credits: Number(fresh.credits), accessEmailSent: Boolean(fresh.access_email_sent_at), emailVerificationRequired: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  const token = randomBytes(32).toString('base64url')
  await createPaidBrowserSession(String(fresh.user_id), token)
  const response = NextResponse.json({ status: 'paid', id: String(order.id), amount: Number(fresh.amount), credits: Number(fresh.credits), accessEmailSent: Boolean(fresh.access_email_sent_at), emailVerificationRequired: false }, { headers: { 'Cache-Control': 'private, no-store' } })
  response.cookies.set(ACCESS_COOKIE, token, ACCESS_COOKIE_OPTIONS)
  return response
}
