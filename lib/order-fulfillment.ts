import 'server-only'
import { getDb } from '@/lib/db'
import type { DreamOrder } from '@/lib/payments'
import { cancelRecoveryEmails, sendAccessEmail } from '@/lib/transactional-email'
import { capturePaidOrder } from '@/lib/product-analytics-server'
import { sendMetaPurchase } from '@/lib/meta-capi'

export async function fulfillOrder(input: {
  order: DreamOrder
  paid: boolean
  refunded: number
  disputed: boolean
  revision: number
  pendingStatus: string
  paidEmail?: string
  bump: boolean
  source: 'comecar' | 'account'
}) {
  const { order, paid, refunded, disputed, revision, pendingStatus, bump, source } = input
  const sql = getDb()
  if (paid && order.preview_id && !order.user_id) {
    const paidEmail = (input.paidEmail || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paidEmail) || paidEmail.length > 254)
      throw new Error('E-mail do checkout inválido.')
    const [matched] = await sql`SELECT id FROM users WHERE lower(email)=${paidEmail} LIMIT 1`
    const [created] = matched ? [null] : await sql`INSERT INTO users(email,name,password_hash)
      VALUES(${paidEmail},${paidEmail.split('@')[0].slice(0,80)},NULL)
      ON CONFLICT(email) DO NOTHING RETURNING id`
    const [existing] = matched ? [matched] : created ? [created] : await sql`SELECT id FROM users WHERE lower(email)=${paidEmail} LIMIT 1`
    if (!existing) throw new Error('Não foi possível associar a compra ao e-mail.')
    await sql`UPDATE dream_orders SET user_id=${existing.id}::uuid,guest_email=${paidEmail},browser_access_granted=${Boolean(created)}
      WHERE id=${order.id}::uuid AND user_id IS NULL`
    const [linked] = await sql`SELECT user_id,guest_email FROM dream_orders WHERE id=${order.id}::uuid`
    order.user_id = String(linked.user_id)
    order.guest_email = String(linked.guest_email)
  }
  // Leituras remotas podem completar fora de ordem; reembolsos sempre crescem no banco.
  await sql`SELECT dream_reconcile_order(${order.id}::uuid,${paid},${refunded},${disputed},${revision}::bigint,${pendingStatus})`
  const [updated] = await sql`SELECT status,credited FROM dream_orders WHERE id=${order.id}::uuid`
  if (paid && order.preview_id && order.guest_email && order.user_id && updated.status === 'paid') {
    const [confirmation] = await sql`UPDATE dream_orders SET purchase_confirmed_at=COALESCE(purchase_confirmed_at,now()) WHERE id=${order.id}::uuid RETURNING purchase_confirmed_at,product_event_sent_at`
    order.purchase_confirmed_at = confirmation?.purchase_confirmed_at as Date | undefined
    const [preview] = await sql`SELECT session_id,attribution FROM onboarding_previews WHERE id=${order.preview_id}::uuid`
    const [lead] = order.lead_id ? await sql`UPDATE onboarding_leads SET purchased_at=COALESCE(purchased_at,now())
      WHERE id=${order.lead_id}::uuid RETURNING session_id,attribution,marketing_consent` : [null]
    if (lead) {
      try { await cancelRecoveryEmails(String(order.lead_id)) }
      catch { console.error('recovery_cancel_failed', { orderId: order.id }) }
    }
    try { await sendMetaPurchase({ id: order.id, email: order.guest_email, amount: order.amount, consent: order.journey_version ? order.marketing_consent === true : lead?.marketing_consent === true }) }
    catch { console.error('meta_purchase_send_failed', { orderId: order.id }) }
    await sql`INSERT INTO onboarding_events(session_id,lead_id,order_id,name,properties,attribution)
      VALUES(${preview?.session_id || null}::uuid,${order.lead_id || null}::uuid,${order.id}::uuid,'purchase_completed',${JSON.stringify({ amount: order.amount, credits: order.credits })}::jsonb,${JSON.stringify(preview?.attribution || order.attribution || {})}::jsonb)
      ON CONFLICT DO NOTHING`
    if (bump) await sql`INSERT INTO onboarding_events(session_id,lead_id,order_id,name,properties,attribution)
      VALUES(${preview?.session_id || null}::uuid,${order.lead_id || null}::uuid,${order.id}::uuid,'order_bump_accepted',${JSON.stringify({ amount: 6200 })}::jsonb,${JSON.stringify(preview?.attribution || order.attribution || {})}::jsonb)
      ON CONFLICT DO NOTHING`
    try {
      if (!confirmation?.product_event_sent_at && await capturePaidOrder(order))
        await sql`UPDATE dream_orders SET product_event_sent_at=now() WHERE id=${order.id}::uuid`
    } catch { console.error('product_purchase_send_failed', { orderId: order.id }) }
    const [claim] = await sql`UPDATE dream_orders SET access_email_sending_at=now()
      WHERE id=${order.id}::uuid AND access_email_sent_at IS NULL
        AND (access_email_sending_at IS NULL OR access_email_sending_at<now()-interval '2 minutes') RETURNING id`
    if (claim) {
      try { await sendAccessEmail(order.id, order.user_id, order.guest_email) }
      catch (error) {
        await sql`UPDATE dream_orders SET access_email_sending_at=NULL WHERE id=${order.id}::uuid`
        console.error('access_email_failed', { orderId: order.id, reason: error instanceof Error ? error.name : 'UnknownError' })
      }
    }
  }
  const [delivery] = order.guest_email
    ? await sql`SELECT access_email_sent_at FROM dream_orders WHERE id=${order.id}::uuid`
    : [null]
  return {
    id: order.id,
    status: String(updated.status),
    credits: Number(updated.credited),
    amount: order.amount,
    mode: order.mode,
    source,
    accessEmailSent: Boolean(delivery?.access_email_sent_at),
  }
}
