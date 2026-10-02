import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const saleId = 'd7224591-861e-4eb9-8411-a321dfaf673b'
const orderId = 'b857878a-22e1-4190-a04f-611d6e03d2a0'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('KIWIFY_API_CLIENT_ID', 'client')
  vi.stubEnv('KIWIFY_API_CLIENT_SECRET', 'secret')
  vi.stubEnv('KIWIFY_API_ACCOUNT_ID', 'account')
  vi.stubEnv('KIWIFY_PRODUCT_ID', 'product')
})

it('checks the remote sale before refunding the authenticated local purchase', async () => {
  const requests: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit) => {
    requests.push(`${init.method} ${input}`)
    if (input.endsWith('/oauth/token')) return Response.json({ access_token: 'token', expires_in: 86400, scope: 'sales sales_refund' })
    if (init.method === 'GET') return Response.json({ id: saleId, status: 'paid', product: { id: 'product' },
      tracking: { sck: orderId }, payment: { charge_amount: 3700 } })
    return Response.json({ refunded: true })
  }))
  const { verifyKiwifySaleForRefund, refundKiwifySale } = await import('./kiwify-refunds')
  await verifyKiwifySaleForRefund(saleId, orderId, 3700)
  await refundKiwifySale(saleId)
  expect(requests).toEqual([
    'POST https://public-api.kiwify.com/v1/oauth/token',
    `GET https://public-api.kiwify.com/v1/sales/${saleId}`,
    `POST https://public-api.kiwify.com/v1/sales/${saleId}/refund`,
  ])
})

it('rejects a sale linked to another order without issuing a refund', async () => {
  const fetch = vi.fn(async (input: string) => input.endsWith('/oauth/token')
    ? Response.json({ access_token: 'token', expires_in: 86400, scope: 'sales sales_refund' })
    : Response.json({ id: saleId, status: 'paid', product: { id: 'product' },
      tracking: { sck: 'other-order' }, payment: { charge_amount: 3700 } }))
  vi.stubGlobal('fetch', fetch)
  const { verifyKiwifySaleForRefund } = await import('./kiwify-refunds')
  await expect(verifyKiwifySaleForRefund(saleId, orderId, 3700)).rejects.toThrow('não corresponde')
  expect(fetch).toHaveBeenCalledTimes(2)
})
