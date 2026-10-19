import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { startGuestCheckout, startGuestPix } from './onboarding-checkout'
import { createAsaasCheckout, createAsaasPixQr, directAsaasPixEnabled } from '@/lib/asaas'

const mocks = vi.hoisted(() => ({ db: vi.fn(), kiwifyEnabled: vi.fn(), kiwifyLocalDemo: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/actions/payments', () => ({ getPaymentOptions: vi.fn(), startDreamCheckout: vi.fn() }))
vi.mock('@/actions/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.db }))
vi.mock('@/lib/kiwify', () => ({ kiwifyOnboardingEnabled: mocks.kiwifyEnabled, kiwifyLocalDemoEnabled: mocks.kiwifyLocalDemo }))
vi.mock('@/lib/onboarding-server', () => ({ getPreviewSession: async () => 'b7a6a430-bb53-4e2d-ad12-bbe2ba19f390' }))
vi.mock('@/lib/stripe', () => ({ billingMode: () => 'live', paymentProvider: () => 'asaas', billingOrigin: vi.fn(), getStripe: vi.fn() }))
vi.mock('@/lib/asaas', () => ({ createAsaasCheckout: vi.fn(), asaasCheckoutUrl: vi.fn(), createAsaasPixQr: vi.fn(), directAsaasPixEnabled: vi.fn() }))

const previewId = '492ee5d0-9598-4d4d-a4ba-60c6af2b1ad0'
const orderId = '60e62b8f-e9ac-4f97-94e8-6d27732fbd5e'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('KIWIFY_CHECKOUT_ONE', 'https://pay.kiwify.com.br/one123')
  vi.stubEnv('KIWIFY_CHECKOUT_THREE', 'https://pay.kiwify.com.br/three123')
  mocks.kiwifyEnabled.mockReturnValue(true)
  mocks.kiwifyLocalDemo.mockReturnValue(false)
  mocks.db.mockImplementation(async (strings: TemplateStringsArray) => {
    const query = strings.join('?')
    if (query.includes('FROM onboarding_previews p')) return [{ lead_id: null, email: null, attribution: {} }]
    if (query.includes('SELECT count(*)')) return [{ n: 0 }]
    if (query.includes('SELECT * FROM dream_orders')) return [{ provider: 'kiwify', mode: 'live', preview_id: previewId, lead_id: null, credits: 3, amount: 9900, price_id: 'three123', status: 'pending' }]
    return []
  })
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })

it('routes the public three-pack to Kiwify without invoking Asaas', async () => {
  const result = await startGuestCheckout(previewId, orderId, { bump: true }, 'kiwify')
  const url = new URL(result.url)
  expect(url.origin).toBe('https://pay.kiwify.com.br')
  expect(url.pathname).toBe('/three123')
  expect(url.searchParams.get('sck')).toBe(orderId)
  expect(url.searchParams.has('email')).toBe(false)
  expect(mocks.db.mock.calls.some(([strings]) => (strings as TemplateStringsArray).join('?').includes("'kiwify'"))).toBe(true)
})

it('refuses the real checkout when its guest route is disabled', async () => {
  mocks.kiwifyEnabled.mockReturnValue(false)
  await expect(startGuestCheckout(previewId, orderId, { bump: true }, 'kiwify')).rejects.toThrow('indisponível')
})

it('keeps a local test order inside the demo instead of opening a live checkout', async () => {
  mocks.kiwifyEnabled.mockReturnValue(false)
  mocks.kiwifyLocalDemo.mockReturnValue(true)
  mocks.db.mockImplementation(async (strings: TemplateStringsArray) => {
    const query = strings.join('?')
    if (query.includes('FROM onboarding_previews p')) return [{ lead_id: null, email: null, attribution: {} }]
    if (query.includes('SELECT count(*)')) return [{ n: 0 }]
    if (query.includes('SELECT * FROM dream_orders')) return [{ provider: 'kiwify', mode: 'test', preview_id: previewId, lead_id: null, credits: 3, amount: 9900, price_id: 'three123', status: 'pending' }]
    return []
  })
  expect(await startGuestCheckout(previewId, orderId, { bump: true }, 'kiwify')).toEqual({ url: `/kiwify-demo?order_id=${orderId}` })
})

it.each([
  ['2026-10-25T23:59:59-03:00', 1990],
  ['2026-10-26T00:00:00-03:00', 3700],
])('charges the authoritative individual price at %s in Kiwify, Asaas card and Pix', async (date, amount) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(date))
  let provider = 'kiwify'
  const email = 'buyer@example.com'
  mocks.db.mockImplementation(async (strings: TemplateStringsArray) => {
    const query = strings.join('?')
    if (query.includes('FROM onboarding_previews p')) return [{ lead_id: null, email: null, attribution: {} }]
    if (query.includes('SELECT count(*)')) return [{ n: 0 }]
    if (query.includes('SELECT * FROM dream_orders')) return [{ provider, mode: 'live', preview_id: previewId, lead_id: null, guest_email: provider === 'pix' ? email : null, credits: 1, amount, price_id: provider === 'kiwify' ? 'one123' : 'asaas:guest:1', status: 'pending' }].map(order => ({ ...order, provider: provider === 'pix' ? 'asaas' : provider }))
    if (query.includes('RETURNING id')) return [{ id: orderId }]
    return []
  })
  const kiwify = await startGuestCheckout(previewId, orderId, {}, 'kiwify')
  expect(new URL(kiwify.url).pathname).toBe('/one123')
  const inserts = () => mocks.db.mock.calls.filter(([strings]) => (strings as TemplateStringsArray).join('?').includes('INSERT INTO dream_orders'))
  expect(inserts()[0]).toContain(amount)
  provider = 'asaas'
  vi.mocked(createAsaasCheckout).mockResolvedValue({ id: 'checkout', url: 'https://asaas.test/checkout' })
  await startGuestCheckout(previewId, orderId)
  expect(createAsaasCheckout).toHaveBeenCalledWith(expect.objectContaining({ amount }))
  provider = 'pix'
  vi.mocked(directAsaasPixEnabled).mockReturnValue(true)
  vi.mocked(createAsaasPixQr).mockResolvedValue({ id: 'qr', payload: 'payload', image: 'image' })
  await startGuestPix(previewId, orderId, email)
  expect(createAsaasPixQr).toHaveBeenCalledWith(orderId, amount)
})

it('does not charge more if the deadline passes while an earlier request is in flight', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-26T00:00:00-03:00'))
  await expect(startGuestCheckout(previewId, orderId, { expectedAmount: 1990 }, 'kiwify')).rejects.toThrow('preço da oferta mudou')
  await expect(startGuestCheckout(previewId, orderId, { expectedAmount: 1990 })).rejects.toThrow('preço da oferta mudou')
  expect(mocks.db.mock.calls.some(([strings]) => (strings as TemplateStringsArray).join('?').includes('INSERT INTO dream_orders'))).toBe(false)
  expect(createAsaasCheckout).not.toHaveBeenCalled()
})
