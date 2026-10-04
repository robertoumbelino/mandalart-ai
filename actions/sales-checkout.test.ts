import { beforeEach, expect, it, vi } from 'vitest'
import { startSalesCheckout } from './sales-checkout'
const mocks = vi.hoisted(() => ({ sql: vi.fn(), pix: vi.fn(), checkout: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.sql }))
vi.mock('@/lib/onboarding-server', () => ({ getPreviewSession: mocks.session }))
vi.mock('./onboarding-checkout', () => ({ startGuestPix: mocks.pix, startGuestCheckout: mocks.checkout }))
const intentId = '492ee5d0-9598-4d4d-a4ba-60c6af2b1ad0'
const input = { answers: { journeyVersion: 'sales-v3', category: 'money', dream: 'Sair das dívidas', obstacle: 'time', horizon: 'month' }, attemptId: 'b7a6a430-bb53-4e2d-ad12-bbe2ba19f390', orderId: '60e62b8f-e9ac-4f97-94e8-6d27732fbd5e', method: 'kiwify' }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue(input.attemptId)
  mocks.sql.mockImplementation(async (strings: TemplateStringsArray) => strings.join('?').includes('count(*)') ? [{ n: 0 }] : [{ id: intentId }])
  mocks.checkout.mockResolvedValue({ url: '/kiwify-demo' })
  mocks.pix.mockResolvedValue({ url: '/pix' })
})
it('stores only the four answers and uses the existing checkout without a generated preview', async () => {
  expect(await startSalesCheckout(input)).toEqual({ url: '/kiwify-demo', intentId })
  const [strings, ...values] = mocks.sql.mock.calls[1]
  expect((strings as TemplateStringsArray).join('?')).not.toContain('preview,')
  expect(JSON.parse(values[2])).toEqual({ ...input.answers, customDream: '' })
  expect(mocks.checkout).toHaveBeenCalledWith(intentId, input.orderId, { analyticsDistinctId: undefined, marketingConsent: false }, 'kiwify')
  expect(mocks.pix).not.toHaveBeenCalled()
})
it('requires the Pix email before writing an intent or opening payment', async () => {
  await expect(startSalesCheckout({ ...input, method: 'pix' })).rejects.toThrow('e-mail')
  expect(mocks.sql).not.toHaveBeenCalled()
  expect(mocks.pix).not.toHaveBeenCalled()
})
it('passes the email and consent to the existing Pix flow', async () => {
  await startSalesCheckout({ ...input, method: 'pix', email: 'delivered@resend.dev', marketingConsent: true, analyticsDistinctId: 'anon' })
  expect(mocks.pix).toHaveBeenCalledWith(intentId, input.orderId, 'delivered@resend.dev', { analyticsDistinctId: 'anon', marketingConsent: true })
})
it('rejects incomplete answers and excessive attempts before opening checkout', async () => {
  await expect(startSalesCheckout({ ...input, answers: { category: 'money' } })).rejects.toThrow()
  expect(mocks.sql).not.toHaveBeenCalled()
  mocks.sql.mockResolvedValue([{ n: 20 }])
  await expect(startSalesCheckout(input)).rejects.toThrow('Aguarde')
  expect(mocks.checkout).not.toHaveBeenCalled()
})
