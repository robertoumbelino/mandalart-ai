import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { POST } from './route'

const mocks = vi.hoisted(() => ({ process: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ billingMode: () => 'live' }))
vi.mock('@/lib/kiwify', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/kiwify')>()
  return { ...original, processKiwifyEvent: mocks.process }
})

beforeEach(() => {
  vi.stubEnv('KIWIFY_WEBHOOK_TOKEN', 'unit-test-token')
  mocks.process.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

it('rejects a forged webhook without processing the purchase', async () => {
  const request = new Request('https://example.com/api/kiwify/webhook?signature=' + '0'.repeat(40), {
    method: 'POST',
    body: JSON.stringify({ order_status: 'paid' }),
  })
  expect((await POST(request)).status).toBe(400)
  expect(mocks.process).not.toHaveBeenCalled()
})

it('passes a signed event to reconciliation', async () => {
  const body = JSON.stringify({ order_status: 'paid' })
  const signature = createHmac('sha1', 'unit-test-token').update(body).digest('hex')
  const request = new Request(`https://example.com/api/kiwify/webhook?signature=${signature}`, {
    method: 'POST',
    body,
  })
  expect((await POST(request)).status).toBe(200)
  expect(mocks.process).toHaveBeenCalledWith({ order_status: 'paid' })
})
