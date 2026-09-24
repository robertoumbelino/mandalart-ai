import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getPaymentOptions } from './payments'

const mocks = vi.hoisted(() => ({ config: vi.fn(), account: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/actions/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: vi.fn() }))
vi.mock('@/lib/payments', () => ({ reconcileCheckout: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  billingConfig: mocks.config,
  billingMode: vi.fn(),
  billingOrigin: vi.fn(),
  getStripe: () => ({ accounts: { retrieve: mocks.account } }),
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('STRIPE_PRICE_ONE', 'price_one')
  vi.stubEnv('STRIPE_PRICE_THREE', 'price_three')
  vi.stubEnv('STRIPE_PAYMENT_CONFIGURATION', 'pmc_fixture')
  mocks.config.mockReturnValue({ mode: 'live', pix: false })
})
afterEach(() => vi.unstubAllEnvs())

it('does not offer live checkout while Stripe has suspended charges', async () => {
  mocks.account.mockResolvedValue({ charges_enabled: false })
  expect(await getPaymentOptions()).toMatchObject({ available: false, mode: 'live' })
})
it('enables live checkout once Stripe approves the account without changing code', async () => {
  mocks.account.mockResolvedValue({ charges_enabled: true })
  expect(await getPaymentOptions()).toMatchObject({ available: true, mode: 'live' })
})
it('keeps local test checkout available during live account verification', async () => {
  mocks.config.mockReturnValue({ mode: 'test', pix: false })
  expect(await getPaymentOptions()).toMatchObject({ available: true, mode: 'test' })
  expect(mocks.account).not.toHaveBeenCalled()
})
it('does not offer checkout with an incomplete price configuration', async () => {
  vi.stubEnv('STRIPE_PRICE_THREE', undefined)
  expect(await getPaymentOptions()).toMatchObject({ available: false })
  expect(mocks.account).not.toHaveBeenCalled()
})
it('keeps checkout unavailable when account readiness cannot be verified', async () => {
  mocks.account.mockRejectedValue(new Error('Stripe unavailable'))
  expect(await getPaymentOptions()).toMatchObject({ available: false })
})
