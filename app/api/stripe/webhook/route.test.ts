import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Stripe from 'stripe'
import { POST } from './route'
vi.mock('server-only', () => ({}))
const processEvent = vi.hoisted(() => vi.fn())
vi.mock('@/lib/payments', () => ({ processStripeEvent: processEvent }))
const stripe = new Stripe('sk_test_unit_test')
const secret = 'whsec_local_unit_test'
const payload = JSON.stringify({
  id: 'evt_test',
  type: 'checkout.session.completed',
  livemode: false,
  data: { object: { id: 'cs_test' } },
})
const request = (signature?: string) =>
  new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body: payload,
    headers: signature ? { 'stripe-signature': signature } : {},
  })
beforeEach(() => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_unit_test')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret)
  processEvent.mockReset().mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllEnvs())
it('rejects a missing signature before fulfillment', async () => {
  expect((await POST(request())).status).toBe(400)
  expect(processEvent).not.toHaveBeenCalled()
})
it('rejects a forged signature', async () => {
  expect((await POST(request('t=1,v1=forged'))).status).toBe(400)
  expect(processEvent).not.toHaveBeenCalled()
})
it('rejects a body modified after signing', async () => {
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: payload + ' ',
    secret,
  })
  expect((await POST(request(signature))).status).toBe(400)
  expect(processEvent).not.toHaveBeenCalled()
})
it('processes a correctly signed raw body', async () => {
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  })
  expect((await POST(request(signature))).status).toBe(200)
  expect(processEvent).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'evt_test' }),
  )
})
it('requests retry when fulfillment fails', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  processEvent.mockRejectedValue(new Error('database down'))
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  })
  expect((await POST(request(signature))).status).toBe(500)
  log.mockRestore()
})
