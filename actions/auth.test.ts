import { beforeEach, expect, it, vi } from 'vitest'
import { getCurrentUserWithCreation } from './auth'

const mocks = vi.hoisted(() => ({ session: vi.fn(), accounts: vi.fn(), query: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/server', () => ({ auth: {} }))
vi.mock('@/lib/auth/reader', () => ({ readAuthSession: mocks.session, readAuthAccounts: mocks.accounts }))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.query }))
vi.mock('@/lib/email-access', () => ({ getEmailAccessUser: vi.fn().mockResolvedValue(null), revokeEmailAccess: vi.fn() }))

let productUser = { id: 'product-user', email: 'buyer@gmail.com', name: 'Compradora', avatar: null }
const authUserId = 'managed-user'
const googleSubject = 'google-subject'
let linkedAuthUser: string | null
let linkedGoogleSubject: string | null

const signIn = (email = productUser.email, emailVerified = true) => {
  mocks.session.mockResolvedValue({ data: { user: { id: authUserId, email, name: 'Google', emailVerified } }, error: null })
  mocks.accounts.mockResolvedValue({ data: [{ providerId: 'google', accountId: googleSubject }], error: null })
}

beforeEach(() => {
  vi.resetAllMocks()
  productUser = { id: 'product-user', email: 'buyer@gmail.com', name: 'Compradora', avatar: null }
  linkedAuthUser = null
  linkedGoogleSubject = null
  signIn()
  mocks.query.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join(' ')
    if (query.includes('FROM auth_user_links link')) return linkedAuthUser === values[0] ? [productUser] : []
    if (query.includes('FROM user_identities identity')) return linkedGoogleSubject === values[0] ? [productUser] : []
    if (query.includes('FROM users') && query.includes('LOWER(email)')) {
      return values[0] === productUser.email ? [productUser] : []
    }
    if (query.includes('WITH inserted AS')) {
      if (linkedGoogleSubject && linkedGoogleSubject !== values[1]) return []
      linkedGoogleSubject = values[1] as string
      return [{ user_id: productUser.id }]
    }
    if (query.includes('INSERT INTO auth_user_links')) {
      linkedAuthUser = values[0] as string
      return []
    }
    throw new Error(`Unexpected query: ${query}`)
  })
})

it('links a verified Gmail to the existing product account while preserving its ID', async () => {
  expect(await getCurrentUserWithCreation()).toEqual({ user: {
    id: productUser.id, email: productUser.email, name: productUser.name, avatar: undefined,
  }, created: false })
  expect(linkedGoogleSubject).toBe(googleSubject)
  expect(linkedAuthUser).toBe(authUserId)
  expect(await getCurrentUserWithCreation()).toHaveProperty('user.id', productUser.id)
})

it('does not replace a different Google identity already linked to that account', async () => {
  linkedGoogleSubject = 'other-google-subject'
  expect(await getCurrentUserWithCreation()).toBeNull()
  expect(linkedAuthUser).toBeNull()
})

it('does not link an unverified Gmail by email', async () => {
  signIn(productUser.email, false)
  expect(await getCurrentUserWithCreation()).toBeNull()
  expect(linkedAuthUser).toBeNull()
})

it('does not treat a third-party address on a Google account as current email ownership', async () => {
  productUser = { ...productUser, email: 'buyer@example.com' }
  signIn(productUser.email)
  expect(await getCurrentUserWithCreation()).toBeNull()
  expect(linkedAuthUser).toBeNull()
})
