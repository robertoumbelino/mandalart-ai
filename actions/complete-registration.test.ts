import { beforeEach, expect, it, vi } from 'vitest'
import { completeRegistration } from './complete-registration'

const mocks = vi.hoisted(() => ({ read: vi.fn(), link: vi.fn(), signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), revoke: vi.fn() }))
vi.mock('@/lib/auth/server', () => ({ auth: { signIn: { email: mocks.signIn }, signUp: { email: mocks.signUp }, signOut: mocks.signOut } }))
vi.mock('@/lib/account-registration', () => ({ registrationFromToken: mocks.read, linkRegistration: mocks.link }))
vi.mock('@/lib/email-access', () => ({ revokeEmailAccess: mocks.revoke }))

const input = { token: 'a'.repeat(43), name: 'Teste Cadastro', password: 'test-only-password', confirmation: 'test-only-password' }
const account = { id: 'paid-user', email: 'buyer@example.com', pending: true }
const identity = { id: 'managed-user', email: account.email }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.read.mockResolvedValue(account)
  mocks.link.mockResolvedValue(true)
  mocks.signIn.mockResolvedValue({ data: { user: identity } })
  mocks.signUp.mockResolvedValue({ data: { user: identity } })
})

it('creates a managed password and links the existing purchaser, preserving the product user ID', async () => {
  mocks.signIn.mockResolvedValueOnce({ error: { message: 'Not found' } })
  expect(await completeRegistration(input)).toEqual({ ok: true })
  expect(mocks.signUp).toHaveBeenCalledWith({ email: account.email, name: input.name, password: input.password })
  expect(mocks.link).toHaveBeenCalledWith(input.token, identity.id, account.id, input.name)
  expect(mocks.revoke).toHaveBeenCalledOnce()
})

it('recovers a retry after the managed identity was created without creating a duplicate', async () => {
  expect(await completeRegistration(input)).toEqual({ ok: true })
  expect(mocks.signUp).not.toHaveBeenCalled()
})

it.each([null, { ...account, pending: false }])('does not change credentials for an invalid token or registered account', async value => {
  mocks.read.mockResolvedValue(value)
  expect(await completeRegistration(input)).toHaveProperty('error')
  expect(mocks.signIn).not.toHaveBeenCalled()
  expect(mocks.signUp).not.toHaveBeenCalled()
  expect(mocks.link).not.toHaveBeenCalled()
})

it('rejects password mismatch before looking up the email proof', async () => {
  expect(await completeRegistration({ ...input, confirmation: 'another-password' })).toHaveProperty('error')
  expect(mocks.read).not.toHaveBeenCalled()
})

it('does not consume the proof if the authentication provider fails', async () => {
  mocks.signIn.mockResolvedValue({ error: { message: 'Unavailable' } })
  mocks.signUp.mockResolvedValue({ error: { message: 'Unavailable' } })
  expect(await completeRegistration(input)).toHaveProperty('error')
  expect(mocks.link).not.toHaveBeenCalled()
})

it('requires the signed-in identity to match the email proven by the token', async () => {
  mocks.signIn.mockResolvedValue({ data: { user: { ...identity, email: 'another@example.com' } } })
  expect(await completeRegistration(input)).toHaveProperty('error')
  expect(mocks.link).not.toHaveBeenCalled()
})

it('rejects a concurrently consumed token and closes the newly opened session', async () => {
  mocks.link.mockResolvedValue(false)
  expect(await completeRegistration(input)).toHaveProperty('error')
  expect(mocks.signOut).toHaveBeenCalledOnce()
})
