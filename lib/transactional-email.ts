import 'server-only'
import { randomBytes, createHash } from 'node:crypto'
import { getDb } from '@/lib/db'
import { billingOrigin } from '@/lib/stripe'
import { createLeadLink, createUnsubscribeLink } from '@/lib/lead-link'
import { allowedLocalEmailRecipient, localEmailTestMode } from '@/lib/email-testing'

const digest = (token: string) => createHash('sha256').update(token).digest('hex')
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]!)

async function sendEmail(to: string, subject: string, html: string, options?: { scheduledAt?: string; idempotencyKey?: string }) {
  if (localEmailTestMode() && !allowedLocalEmailRecipient(to))
    throw new Error('No ambiente local, use somente um endereço de teste do Resend.')
  const key = process.env.RESEND_API_KEY
  const from = process.env.TRANSACTIONAL_EMAIL_FROM
  if (!key || !from) throw new Error('Envio de e-mail não configurado.')
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}) },
    body: JSON.stringify({ from, to: [to], subject, html, ...(options?.scheduledAt ? { scheduled_at: options.scheduledAt } : {}) }),
  })
  if (!response.ok) throw new Error(`Falha ao enviar e-mail: HTTP ${response.status}`)
  const result = await response.json() as { id?: string }
  if (!result.id) throw new Error('Resposta do provedor de e-mail sem identificador.')
  return result.id
}

export async function sendAccessEmail(orderId: string, userId: string, email: string) {
  if (!process.env.RESEND_API_KEY || !process.env.TRANSACTIONAL_EMAIL_FROM)
    throw new Error('Envio de e-mail não configurado.')
  const token = randomBytes(32).toString('base64url')
  const hash = digest(token)
  await getDb()`INSERT INTO email_access_tokens(user_id,token_hash,expires_at)
    VALUES(${userId}::uuid,${hash},now()+interval '48 hours')`
  const url = `${billingOrigin()}/api/access/redeem?token=${encodeURIComponent(token)}`
  await sendEmail(email, 'Seu Mandalart está liberado', `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#25304b"><h1>Seu Mandalart está liberado</h1><p>Seu pagamento foi confirmado. Use o botão abaixo para abrir sua conta e continuar seu sonho, sem senha.</p><p><a href="${escape(url)}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#6334ff;color:white;text-decoration:none">Abrir meu Mandalart</a></p><p>Este link funciona por 48 horas e pode ser usado uma vez. Se você não solicitou esta compra, ignore a mensagem.</p></div>`, { idempotencyKey: `access-${orderId}` })
  await getDb()`UPDATE dream_orders SET access_email_sent_at=now(),access_email_sending_at=NULL WHERE id=${orderId}::uuid AND user_id=${userId}::uuid`
}

export async function sendSignInEmail(userId: string, email: string) {
  if (!process.env.RESEND_API_KEY || !process.env.TRANSACTIONAL_EMAIL_FROM)
    throw new Error('Envio de e-mail não configurado.')
  const token = randomBytes(32).toString('base64url')
  const hash = digest(token)
  await getDb()`INSERT INTO email_access_tokens(user_id,token_hash,expires_at)
    VALUES(${userId}::uuid,${hash},now()+interval '48 hours')`
  const url = `${billingOrigin()}/api/access/redeem?token=${encodeURIComponent(token)}`
  await sendEmail(email, 'Seu link de acesso ao Mandalart', `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#25304b"><h1>Volte ao seu Mandalart</h1><p>Use este link para entrar sem senha e continuar seus planos.</p><p><a href="${escape(url)}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#6334ff;color:white;text-decoration:none">Acessar meu Mandalart</a></p><p>O link funciona por 48 horas e pode ser usado uma vez. Se você não pediu este acesso, ignore a mensagem.</p></div>`, { idempotencyKey: `signin-${hash}` })
}

function previewHtml(subject: string, url: string, extra: string, unsubscribeUrl: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#25304b"><h1>${escape(subject)}</h1><p>${escape(extra)}</p><p><a href="${escape(url)}" style="display:inline-block;padding:14px 22px;border-radius:10px;background:#6334ff;color:white;text-decoration:none">Abrir meu primeiro caminho</a></p><p>O plano completo é opcional. <a href="${escape(unsubscribeUrl)}">Não quero receber mais lembretes</a>.</p></div>`
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
      await sendEmail(email, 'Seu primeiro caminho está pronto', previewHtml('Seu primeiro caminho está pronto', url, 'Sua prévia está salva. Abra quando quiser e continue seu primeiro passo.', unsubscribeUrl), { idempotencyKey: `preview-${leadId}` })
      await sql`UPDATE onboarding_leads SET preview_email_sent_at=now() WHERE id=${leadId}::uuid`
    }
    if (!localEmailTestMode() && !claim.recovery_one_email_id) {
      const id = await sendEmail(email, 'Seu primeiro caminho está esperando', previewHtml('Seu primeiro caminho está esperando', url, 'Você começou a transformar seu sonho em um caminho possível. Seu primeiro passo continua esperando por você.', unsubscribeUrl), { scheduledAt: new Date(Date.now()+60*60*1000).toISOString(), idempotencyKey: `recovery-1-${leadId}` })
      await sql`UPDATE onboarding_leads SET recovery_one_email_id=${id} WHERE id=${leadId}::uuid`
    }
    if (!localEmailTestMode() && !claim.recovery_two_email_id) {
      const id = await sendEmail(email, 'Volte ao seu Mandalart quando quiser', previewHtml('Volte ao seu Mandalart quando quiser', url, 'Sua prévia continua disponível. Um pequeno passo hoje pode ajudar a dar clareza ao seu sonho.', unsubscribeUrl), { scheduledAt: new Date(Date.now()+24*60*60*1000).toISOString(), idempotencyKey: `recovery-2-${leadId}` })
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
