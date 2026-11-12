import { beforeEach, expect, it, vi } from 'vitest'
import type { EmailReceivedEvent } from 'resend'
import { forwardInboundEmail } from './inbound-email'

vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ get: vi.fn(), send: vi.fn(), sql: vi.fn(), fetch: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.sql }))
vi.mock('resend', () => ({ Resend: class {
  emails = { receiving: { get: mocks.get }, send: mocks.send }
} }))
const id = '5d4fc35f-10ce-4526-95fa-356c27942039'
const event = { type: 'email.received', created_at: new Date().toISOString(), data: {
  email_id: id, from: 'Cliente <cliente@example.com>', to: ['ola@mail.mandalart.com.br'],
  subject: 'Ajuda', message_id: '<test@example.com>', attachments: [], bcc: [], cc: [],
} } as EmailReceivedEvent
const raw = [
  'From: Cliente <cliente@example.com>', 'To: ola@mail.mandalart.com.br',
  'Subject: Ajuda', 'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="copy"', '',
  '--copy', 'Content-Type: text/plain; charset=utf-8', '', 'Preciso de ajuda.',
  '--copy', 'Content-Type: image/png; name="foto.png"', 'Content-Transfer-Encoding: base64',
  'Content-Disposition: inline; filename="foto.png"', 'Content-ID: <foto>', '', 'aW1hZ2U=', '--copy--', '',
].join('\r\n')
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('LOCAL_DATABASE_ONLY', 'false')
  vi.stubEnv('RESEND_RECEIVING_API_KEY', 're_test')
  vi.stubEnv('TRANSACTIONAL_EMAIL_FROM', 'Mandalart <ola@mail.mandalart.com.br>')
  vi.stubEnv('INBOUND_EMAIL_FORWARD_TO', 'beto.umbelino@gmail.com')
  mocks.sql.mockResolvedValue([])
  mocks.get.mockResolvedValue({ data: { ...event.data, raw: { download_url: 'https://example.com/raw' } }, error: null })
  mocks.send.mockResolvedValue({ data: { id: '7edb11e6-a944-4089-a7cd-5c7abc3bb177' }, error: null })
  mocks.fetch.mockResolvedValue(new Response(raw))
  vi.stubGlobal('fetch', mocks.fetch)
})
it('forwards the original body, sender, reply address, attachment and inline image ID', async () => {
  expect(await forwardInboundEmail(event)).toBe('forwarded')
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
    to: ['beto.umbelino@gmail.com'], subject: '[Mandalart] Ajuda', replyTo: 'cliente@example.com',
    text: expect.stringContaining('Preciso de ajuda.'),
    html: expect.stringContaining('Cliente &lt;cliente@example.com&gt;'),
    attachments: [{ filename: 'foto.png', content: 'aW1hZ2U=', contentType: 'image/png', contentId: 'foto' }],
  }), expect.objectContaining({ idempotencyKey: `inbound-forward-${id}-beto.umbelino@gmail.com` }))
  expect(mocks.sql).toHaveBeenCalledTimes(2)
})
it('never forwards emails sent to another product in the Resend account', async () => {
  expect(await forwardInboundEmail({ ...event, data: { ...event.data, to: ['outro@example.com'] } })).toBe('ignored')
  expect(mocks.sql).not.toHaveBeenCalled()
  expect(mocks.get).not.toHaveBeenCalled()
})
it('checks the real recipient in Resend before downloading or sending content', async () => {
  mocks.get.mockResolvedValue({ data: { to: ['outro@example.com'], raw: { download_url: 'https://example.com/raw' } }, error: null })
  expect(await forwardInboundEmail(event)).toBe('ignored')
  expect(mocks.fetch).not.toHaveBeenCalled()
  expect(mocks.send).not.toHaveBeenCalled()
})
it('does not read or send an email already copied successfully', async () => {
  mocks.sql.mockResolvedValue([{ sent_email_id: 'sent' }])
  expect(await forwardInboundEmail(event)).toBe('already_forwarded')
  expect(mocks.get).not.toHaveBeenCalled()
  expect(mocks.send).not.toHaveBeenCalled()
})
it('does not record success after a provider failure', async () => {
  mocks.send.mockResolvedValue({ data: null, error: { message: 'timeout' } })
  await expect(forwardInboundEmail(event)).rejects.toThrow('Could not forward')
  expect(mocks.sql).toHaveBeenCalledTimes(1)
})
it('fails safely without a key that can read incoming mail', async () => {
  vi.stubEnv('RESEND_RECEIVING_API_KEY', '')
  await expect(forwardInboundEmail(event)).rejects.toThrow('not configured')
  expect(mocks.get).not.toHaveBeenCalled()
})
it('uses the Resend simulator instead of Gmail during local development', async () => {
  vi.stubEnv('LOCAL_DATABASE_ONLY', 'true')
  await forwardInboundEmail(event)
  expect(mocks.send.mock.calls[0][0].to[0]).toMatch(/^delivered\+.*@resend\.dev$/)
})
