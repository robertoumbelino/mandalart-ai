import { createHmac } from 'node:crypto'
import { beforeEach, expect, it, vi } from 'vitest'
import { POST } from './route'

const mocks = vi.hoisted(() => ({ forward: vi.fn() }))
vi.mock('@/lib/inbound-email', () => ({ forwardInboundEmail: mocks.forward }))
const key = Buffer.from('01234567890123456789012345678901')
const secret = `whsec_${key.toString('base64')}`
const body = JSON.stringify({ type: 'email.received', data: { email_id: '5d4fc35f-10ce-4526-95fa-356c27942039' } })
function request(payload = body, timestamp = String(Math.floor(Date.now() / 1000))) {
  const id = 'msg_test'
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64')
  return new Request('https://mandalart.com.br/api/resend/webhook', { method: 'POST', body: payload,
    headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` } })
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('RESEND_RECEIVING_WEBHOOK_SECRET', secret)
  mocks.forward.mockResolvedValue('forwarded')
})
it('validates a real signed payload before forwarding', async () => {
  expect((await POST(request())).status).toBe(200)
  expect(mocks.forward).toHaveBeenCalledWith(JSON.parse(body))
})
it('rejects forged signatures without reading email content', async () => {
  const signed = request()
  signed.headers.set('svix-signature', 'v1,invalid')
  expect((await POST(signed)).status).toBe(400)
  expect(mocks.forward).not.toHaveBeenCalled()
})
it('rejects expired signatures', async () => {
  expect((await POST(request(body, '1000'))).status).toBe(400)
  expect(mocks.forward).not.toHaveBeenCalled()
})
it('ignores other signed events', async () => {
  expect((await POST(request(JSON.stringify({ type: 'email.sent' })))).status).toBe(200)
  expect(mocks.forward).not.toHaveBeenCalled()
})
it('returns an error so Resend retries temporary forwarding failures', async () => {
  mocks.forward.mockRejectedValue(new Error('provider timeout'))
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  expect((await POST(request())).status).toBe(500)
  expect(log).toHaveBeenCalledWith('inbound_email_forward_failed', { emailId: JSON.parse(body).data.email_id })
  log.mockRestore()
})
it('stays disabled until a signing secret is configured', async () => {
  vi.stubEnv('RESEND_RECEIVING_WEBHOOK_SECRET', '')
  expect((await POST(request())).status).toBe(503)
  expect(mocks.forward).not.toHaveBeenCalled()
})
