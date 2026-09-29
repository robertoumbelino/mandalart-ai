import { beforeEach, expect, it, vi } from 'vitest'
import { completeGoogleRegistration } from './complete-google-registration'

const mocks = vi.hoisted(() => ({ purchase: vi.fn(), consume: vi.fn(), session: vi.fn(), accounts: vi.fn(), current: vi.fn(), revoke: vi.fn() }))
vi.mock('@/lib/account-registration', () => ({ registrationFromToken: mocks.purchase, consumeRegistrationToken: mocks.consume }))
vi.mock('@/lib/auth/reader', () => ({ readAuthSession: mocks.session, readAuthAccounts: mocks.accounts }))
vi.mock('@/actions/auth', () => ({ getCurrentUserWithCreation: mocks.current }))
vi.mock('@/lib/email-access', () => ({ revokeEmailAccess: mocks.revoke }))

const token = 'a'.repeat(43)
const purchase = { id: 'paid-user', email: 'buyer@gmail.com', pending: true }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.purchase.mockResolvedValue(purchase)
  mocks.session.mockResolvedValue({ data: { user: { id: 'managed-user', email: purchase.email, emailVerified: true } }, error: null })
  mocks.accounts.mockResolvedValue({ data: [{ providerId: 'google', accountId: 'google-subject' }], error: null })
  mocks.current.mockResolvedValue({ user: { id: purchase.id }, created: false })
})

it('opens the paid account after signing in with the same Gmail', async () => {
  expect(await completeGoogleRegistration(token)).toEqual({ ok: true, userId: purchase.id, completed: true })
  expect(mocks.current).toHaveBeenCalledOnce()
  expect(mocks.revoke).toHaveBeenCalledOnce()
  expect(mocks.consume).toHaveBeenCalledWith(token, purchase.id)
})

it('rejects a different Google account before linking any purchase', async () => {
  mocks.session.mockResolvedValue({ data: { user: { id: 'other-user', email: 'other@gmail.com', emailVerified: true } }, error: null })
  expect(await completeGoogleRegistration(token)).toHaveProperty('error')
  expect(mocks.current).not.toHaveBeenCalled()
  expect(mocks.consume).not.toHaveBeenCalled()
})

it('requires a verified Gmail and a Google identity', async () => {
  mocks.session.mockResolvedValue({ data: { user: { id: 'managed-user', email: purchase.email, emailVerified: false } }, error: null })
  expect(await completeGoogleRegistration(token)).toHaveProperty('error')
  mocks.session.mockResolvedValue({ data: { user: { id: 'managed-user', email: purchase.email, emailVerified: true } }, error: null })
  mocks.accounts.mockResolvedValue({ data: [], error: null })
  expect(await completeGoogleRegistration(token)).toHaveProperty('error')
  expect(mocks.current).not.toHaveBeenCalled()
})

it('does not grant the purchase if the Google identity resolves to another product account', async () => {
  mocks.current.mockResolvedValue({ user: { id: 'other-paid-user' }, created: false })
  expect(await completeGoogleRegistration(token)).toHaveProperty('error')
  expect(mocks.revoke).not.toHaveBeenCalled()
  expect(mocks.consume).not.toHaveBeenCalled()
})
