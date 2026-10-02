import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { completeKiwifyDemoOrder, getKiwifyDemoOrder } from './kiwify-demo'

const mocks = vi.hoisted(() => ({ db: vi.fn(), enabled: vi.fn(), process: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/kiwify', () => ({ kiwifyLocalDemoEnabled: mocks.enabled, processKiwifyEvent: mocks.process }))
vi.mock('@/lib/onboarding-server', () => ({ getPreviewSession: async () => 'b7a6a430-bb53-4e2d-ad12-bbe2ba19f390' }))

const id = '60e62b8f-e9ac-4f97-94e8-6d27732fbd5e'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('KIWIFY_PRODUCT_ID', 'product-test')
  mocks.enabled.mockReturnValue(true)
  mocks.db.mockResolvedValue([{ id, credits: 3, amount: 9900, price_id: 'three123', status: 'pending' }])
  mocks.process.mockResolvedValue('processed')
})
afterEach(() => vi.unstubAllEnvs())

it('blocks the simulation when the local-only guard is off', async () => {
  mocks.enabled.mockReturnValue(false)
  await expect(completeKiwifyDemoOrder(id, 'buyer@example.com', 'pix')).rejects.toThrow('somente no ambiente local')
  expect(mocks.db).not.toHaveBeenCalled()
})

it('requires an order owned by this preview session', async () => {
  mocks.db.mockResolvedValue([])
  await expect(getKiwifyDemoOrder(id)).rejects.toThrow('não encontrado neste navegador')
  expect(mocks.process).not.toHaveBeenCalled()
})

it('simulates approval through the normal Kiwify fulfillment path', async () => {
  expect(await completeKiwifyDemoOrder(id, ' Buyer@Example.com ', 'card')).toEqual({ completed: true })
  expect(mocks.process).toHaveBeenCalledWith(expect.objectContaining({
    order_status: 'paid',
    webhook_event_type: 'order_approved',
    payment_method: 'credit_card',
    Customer: { email: 'buyer@example.com' },
    Commissions: expect.objectContaining({ charge_amount: 9900, product_base_price: 9900 }),
    TrackingParameters: { sck: id },
    checkout_link: 'three123',
  }))
})

it('refuses an already completed local order', async () => {
  mocks.db.mockResolvedValue([{ id, credits: 1, amount: 3700, price_id: 'one123', status: 'paid' }])
  await expect(completeKiwifyDemoOrder(id, 'buyer@example.com', 'pix')).rejects.toThrow('já foi concluído')
  expect(mocks.process).not.toHaveBeenCalled()
})
