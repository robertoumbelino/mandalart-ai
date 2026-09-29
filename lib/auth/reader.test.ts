import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NEON_AUTH_SESSION_COOKIE_NAME } from '@neondatabase/auth/server'

const request = vi.hoisted(() => ({
  cookie: '',
  originalCookie: '',
  write: vi.fn(() => { throw new Error('Cookies can only be modified in a Server Action or Route Handler.') }),
}))
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => name === '__Secure-neon-auth.session_token' && request.cookie
      ? { value: request.cookie } : undefined,
    toString: () => request.cookie ? `__Secure-neon-auth.session_token=${request.cookie}; unrelated=private` : '',
    set: request.write,
  }),
  headers: async () => new Headers({ cookie: request.originalCookie, origin: 'https://app.example.com' }),
}))

beforeEach(() => {
  vi.resetModules()
  request.cookie = ''
  request.originalCookie = ''
  request.write.mockClear()
  vi.stubEnv('NEON_AUTH_BASE_URL', 'https://auth.example.com/auth')
  vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'test-only-cookie-secret-at-least-32-characters')
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('session reads during Server Component rendering', () => {
  it('uses the updated cookie jar after logout, not the stale request header', async () => {
    request.originalCookie = `${NEON_AUTH_SESSION_COOKIE_NAME}=revoked-token`
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { readAuthSession } = await import('./reader')
    expect(await readAuthSession()).toEqual({ data: null, error: null })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(request.write).not.toHaveBeenCalled()
  })

  it('returns anonymous when an expired session causes upstream cookie deletion', async () => {
    request.cookie = 'expired-token'
    const fetchMock = vi.fn().mockResolvedValue(Response.json(null, { headers: {
      'set-cookie': `${NEON_AUTH_SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; Secure; HttpOnly`,
    } }))
    vi.stubGlobal('fetch', fetchMock)
    const { readAuthSession } = await import('./reader')
    expect(await readAuthSession()).toEqual({ data: null, error: null })
    expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe(`${NEON_AUTH_SESSION_COOKIE_NAME}=expired-token`)
    expect(request.write).not.toHaveBeenCalled()
  })

  it('preserves a valid upstream session when it refreshes a cookie', async () => {
    request.cookie = 'valid-token'
    const session = { user: { id: 'user-1', email: 'test@example.com' }, session: { id: 'session-1' } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(session, { headers: {
      'set-cookie': '__Secure-neon-auth.session_data=refreshed; Path=/; Secure; HttpOnly',
    } })))
    const { readAuthSession } = await import('./reader')
    expect(await readAuthSession()).toEqual({ data: session, error: null })
    expect(request.write).not.toHaveBeenCalled()
  })

  it('keeps upstream errors visible instead of treating every exception as logout', async () => {
    request.cookie = 'valid-token'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Unavailable' }, { status: 503 })))
    const { readAuthSession } = await import('./reader')
    expect(await readAuthSession()).toMatchObject({ data: null, error: { status: 503 } })
  })
})
