import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import { getDb } from '@/lib/db'
import { getCurrentUser } from '@/actions/auth'
import { registrationPending } from '@/lib/account-registration'

vi.mock('@/lib/db', () => ({ getDb: vi.fn() }))
vi.mock('@/actions/auth', () => ({ getCurrentUser: vi.fn() }))
vi.mock('@/lib/account-registration', () => ({ registrationPending: vi.fn() }))
vi.mock('@/lib/onboarding-server', () => ({ getPreviewSession: vi.fn(async () => 'visitor') }))
vi.mock('@/lib/payments', () => ({ reconcileCheckout: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ billingMode: () => 'test' }))

const answers = { category: 'learning', dream: 'Aprender um idioma', stage: 'idea', obstacle: 'direction', time: 'one', horizon: 'quarter' }
const request = () => new Request('http://localhost:3100/api/onboarding/payment?session_id=cs_test_123456789012345')
function order(status = 'paid') {
  const query = vi.fn().mockResolvedValueOnce([{ id: 'order', preview_id: 'preview', answers }])
    .mockResolvedValueOnce([{ status, user_id: 'buyer', amount: 3700, credits: 1, access_email_sent_at: new Date() }])
  vi.mocked(getDb).mockReturnValue(query as never)
}

describe('checkout return account access', () => {
  beforeEach(() => vi.resetAllMocks())
  it('requires registration for a new buyer without granting an authenticated cookie', async () => {
    order()
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    vi.mocked(registrationPending).mockResolvedValue(true)
    const response = await GET(request())
    expect(await response.json()).toMatchObject({ status: 'paid', registrationRequired: true, authenticated: false, previewId: 'preview' })
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
  it('does not treat a different logged-in account as the buyer', async () => {
    order()
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'other-account' } as never)
    vi.mocked(registrationPending).mockResolvedValue(false)
    expect(await (await GET(request())).json()).toMatchObject({ registrationRequired: false, authenticated: false })
  })
  it('allows an already authenticated buyer to continue', async () => {
    order()
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'buyer' } as never)
    vi.mocked(registrationPending).mockResolvedValue(false)
    expect(await (await GET(request())).json()).toMatchObject({ registrationRequired: false, authenticated: true })
  })
  it('does not check account access until payment is confirmed', async () => {
    order('pending')
    expect(await (await GET(request())).json()).toEqual({ status: 'pending' })
    expect(registrationPending).not.toHaveBeenCalled()
    expect(getCurrentUser).not.toHaveBeenCalled()
  })
})
