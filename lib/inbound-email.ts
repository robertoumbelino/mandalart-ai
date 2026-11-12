import 'server-only'
import PostalMime from 'postal-mime'
import { Resend, type EmailReceivedEvent } from 'resend'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { SUPPORT_EMAIL } from '@/lib/support'
import { emailDeliveryRecipient } from '@/lib/email-testing'

const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const address = (value: string) => (value.match(/<([^<>]+)>$/)?.[1] || value).trim().toLowerCase()

export async function forwardInboundEmail(event: EmailReceivedEvent) {
  if (!event.data.to.some(to => address(to) === SUPPORT_EMAIL)) return 'ignored'
  const id = z.uuid().parse(event.data.email_id)
  const recipient = emailDeliveryRecipient(z.email().parse(process.env.INBOUND_EMAIL_FORWARD_TO))
  const key = process.env.RESEND_RECEIVING_API_KEY
  const from = process.env.TRANSACTIONAL_EMAIL_FROM
  if (!key || !from) throw new Error('Inbound forwarding is not configured')
  const sql = getDb()
  const [sent] = await sql`SELECT sent_email_id FROM inbound_email_forwards WHERE email_id=${id}::uuid AND recipient=${recipient}`
  if (sent) return 'already_forwarded'

  const resend = new Resend(key)
  const { data: email, error: readError } = await resend.emails.receiving.get(id)
  if (readError || !email?.raw?.download_url) throw new Error('Could not read inbound email')
  // Confere o destinatário também no registro do provedor, antes de copiar conteúdo.
  if (!email.to.some(to => address(to) === SUPPORT_EMAIL)) return 'ignored'
  const rawUrl = new URL(email.raw.download_url)
  if (rawUrl.protocol !== 'https:') throw new Error('Invalid raw email URL')
  const raw = await fetch(rawUrl, { signal: AbortSignal.timeout(20_000) })
  if (!raw.ok) throw new Error('Could not download inbound email')
  const parsed = await PostalMime.parse(await raw.arrayBuffer(), { attachmentEncoding: 'base64' })
  const originalFrom = email.from.replace(/[\r\n]/g, ' ')
  const subject = (email.subject || '(sem assunto)').replace(/[\r\n]/g, ' ')
  const link = `https://resend.com/emails/${id}`
  const heading = `Cópia do e-mail recebido pelo Mandalart\nDe: ${originalFrom}\nPara: ${SUPPORT_EMAIL}\nOriginal na Resend: ${link}`
  const replyTo = parsed.replyTo?.[0]?.address || parsed.from?.address
  const { data: forwarded, error: sendError } = await resend.emails.send({
    from,
    to: [recipient],
    subject: `[Mandalart] ${subject}`,
    ...(replyTo && z.email().safeParse(replyTo).success ? { replyTo } : {}),
    text: `${heading}\n\n${parsed.text || ''}`,
    html: `<div><p><strong>Cópia do e-mail recebido pelo Mandalart</strong><br>De: ${escapeHtml(originalFrom)}<br>Para: ${SUPPORT_EMAIL}<br><a href="${link}">Ver original na Resend</a></p><hr>${parsed.html || `<pre>${escapeHtml(parsed.text || '')}</pre>`}</div>`,
    attachments: parsed.attachments.map(attachment => ({
      filename: attachment.filename || 'anexo',
      content: String(attachment.content),
      contentType: attachment.mimeType,
      ...(attachment.contentId ? { contentId: attachment.contentId.replace(/^<|>$/g, '') } : {}),
    })),
  }, { idempotencyKey: `inbound-forward-${id}-${recipient}`, signal: AbortSignal.timeout(20_000) })
  if (sendError || !forwarded?.id) throw new Error('Could not forward inbound email')
  await sql`INSERT INTO inbound_email_forwards(email_id,recipient,sent_email_id)
    VALUES(${id}::uuid,${recipient},${forwarded.id}::uuid) ON CONFLICT DO NOTHING`
  return 'forwarded'
}
