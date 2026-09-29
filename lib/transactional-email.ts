import 'server-only'
import { randomBytes, createHash, createHmac } from 'node:crypto'
import { getDb } from '@/lib/db'
import { billingOrigin } from '@/lib/stripe'
import { createLeadLink, createUnsubscribeLink } from '@/lib/lead-link'
import { emailDeliveryRecipient, localEmailTestMode } from '@/lib/email-testing'
import { purchaseEmail, registrationEmail, previewEmail } from '@/lib/email-template'

const digest = (token: string) => createHash('sha256').update(token).digest('hex')

async function sendEmail(to: string, subject: string, html: string, options?: { scheduledAt?: string; idempotencyKey?: string }) {
  const recipient = emailDeliveryRecipient(to)
  const deliverySubject = localEmailTestMode() ? `[TESTE LOCAL: ${to}] ${subject}` : subject
  const key = process.env.RESEND_API_KEY
  const from = process.env.TRANSACTIONAL_EMAIL_FROM
  if (!key || !from) throw new Error('Envio de e-mail não configurado.')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}) },
    body: JSON.stringify({ from, to: [recipient], subject: deliverySubject, html, ...(options?.scheduledAt ? { scheduled_at: options.scheduledAt } : {}) }),
  })
  if (!response.ok) throw new Error(`Falha ao enviar e-mail: HTTP ${response.status}`)
  const result = await response.json() as { id?: string }
  if (!result.id) throw new Error('Resposta do provedor de e-mail sem identificador.')
  return result.id
}

export async function sendAccessEmail(orderId: string, userId: string, email: string) {
  if (!process.env.RESEND_API_KEY || !process.env.TRANSACTIONAL_EMAIL_FROM)
    throw new Error('Envio de e-mail não configurado.')
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET não configurado.')
  // The provider idempotency key and its payload must stay identical on retry.
  const token = createHmac('sha256', secret).update(`purchase-access:${orderId}:${userId}`).digest('base64url')
  const hash = digest(token)
  await getDb()`INSERT INTO email_access_tokens(user_id,token_hash,expires_at)
    VALUES(${userId}::uuid,${hash},now()+interval '48 hours') ON CONFLICT(token_hash) DO NOTHING`
  const [order] = await getDb()`SELECT amount,credits FROM dream_orders WHERE id=${orderId}::uuid AND user_id=${userId}::uuid`
  if (!order) throw new Error('Compra não encontrada.')
  const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(order.amount) / 100)
  const url = `${billingOrigin()}/finalizar-cadastro?token=${encodeURIComponent(token)}`
  await sendEmail(email, 'Compra confirmada — conclua seu cadastro no Mandalart', purchaseEmail(price, Number(order.credits), url, `${billingOrigin()}/?entrar=1&continuar=sonho`, `${billingOrigin()}/acessar`), { idempotencyKey: `purchase-registration-${orderId}` })
  await getDb()`UPDATE dream_orders SET access_email_sent_at=now(),access_email_sending_at=NULL WHERE id=${orderId}::uuid AND user_id=${userId}::uuid`
}

export async function sendRegistrationEmail(userId: string, email: string) {
  if (!process.env.RESEND_API_KEY || !process.env.TRANSACTIONAL_EMAIL_FROM)
    throw new Error('Envio de e-mail não configurado.')
  const token = randomBytes(32).toString('base64url')
  const hash = digest(token)
  await getDb()`INSERT INTO email_access_tokens(user_id,token_hash,expires_at)
    VALUES(${userId}::uuid,${hash},now()+interval '48 hours')`
  const url = `${billingOrigin()}/finalizar-cadastro?token=${encodeURIComponent(token)}`
  await sendEmail(email, 'Conclua seu cadastro no Mandalart', registrationEmail(url), { idempotencyKey: `registration-${hash}` })
}

export async function sendPreviewAndScheduleRecovery(leadId: string) {
  const sql = getDb()
  const [claim] = await sql`UPDATE onboarding_leads SET recovery_scheduling_at=now()
    WHERE id=${leadId}::uuid AND preview_id IS NOT NULL AND preview_viewed_at IS NOT NULL
      AND purchased_at IS NULL AND recovery_unsubscribed_at IS NULL AND recovery_scheduling_at IS NULL
    RETURNING email,preview_email_sent_at,recovery_one_email_id,recovery_two_email_id`
  if (!claim) return
  const email = String(claim.email)
  const url = createLeadLink(leadId)
  const unsubscribeUrl = createUnsubscribeLink(leadId)
  try {
    if (!claim.preview_email_sent_at) {
      await sendEmail(email, 'Seu primeiro caminho está pronto', previewEmail('Seu primeiro caminho está pronto', url, 'Sua prévia está salva. Abra quando quiser e continue seu primeiro passo.', unsubscribeUrl), { idempotencyKey: `preview-${leadId}` })
      await sql`UPDATE onboarding_leads SET preview_email_sent_at=now() WHERE id=${leadId}::uuid`
    }
    if (!localEmailTestMode() && !claim.recovery_one_email_id) {
      const id = await sendEmail(email, 'Seu primeiro caminho está esperando', previewEmail('Seu primeiro caminho está esperando', url, 'Você começou a transformar seu sonho em um caminho possível. Seu primeiro passo continua esperando por você.', unsubscribeUrl), { scheduledAt: new Date(Date.now()+60*60*1000).toISOString(), idempotencyKey: `recovery-1-${leadId}` })
      await sql`UPDATE onboarding_leads SET recovery_one_email_id=${id} WHERE id=${leadId}::uuid`
    }
    if (!localEmailTestMode() && !claim.recovery_two_email_id) {
      const id = await sendEmail(email, 'Volte ao seu Mandalart quando quiser', previewEmail('Volte ao seu Mandalart quando quiser', url, 'Sua prévia continua disponível. Um pequeno passo hoje pode ajudar a dar clareza ao seu sonho.', unsubscribeUrl), { scheduledAt: new Date(Date.now()+24*60*60*1000).toISOString(), idempotencyKey: `recovery-2-${leadId}` })
      await sql`UPDATE onboarding_leads SET recovery_two_email_id=${id} WHERE id=${leadId}::uuid`
    }
  } finally {
    await sql`UPDATE onboarding_leads SET recovery_scheduling_at=NULL WHERE id=${leadId}::uuid`
  }
  const [lead] = await sql`SELECT purchased_at,recovery_unsubscribed_at FROM onboarding_leads WHERE id=${leadId}::uuid`
  if (lead.purchased_at || lead.recovery_unsubscribed_at) await cancelRecoveryEmails(leadId)
}

export async function cancelRecoveryEmails(leadId: string) {
  const key = process.env.RESEND_API_KEY
  if (!key) return
  const [lead] = await getDb()`SELECT recovery_one_email_id,recovery_two_email_id FROM onboarding_leads WHERE id=${leadId}::uuid`
  if (!lead) return
  for (const id of [lead.recovery_one_email_id,lead.recovery_two_email_id]) {
    if (!id) continue
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(String(id))}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${key}` } })
    if (!response.ok && response.status !== 409 && response.status !== 422) console.error('recovery_cancel_failed', { leadId, status: response.status })
  }
}

export function tokenHash(token: string) { return digest(token) }
