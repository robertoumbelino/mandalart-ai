import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { sendAccessEmail, sendRegistrationEmail } from './transactional-email'

vi.mock('server-only', () => ({}))
const { sql } = vi.hoisted(() => ({ sql: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => sql }))
vi.mock('@/lib/stripe', () => ({ emailOrigin: () => 'http://localhost:3100' }))

beforeEach(() => {
  sql.mockReset().mockImplementation(async (strings: TemplateStringsArray) => strings.join('').startsWith('SELECT amount') ? [{ amount: 3700, credits: 1 }] : [])
  vi.stubEnv('RESEND_API_KEY', 're_test')
  vi.stubEnv('TRANSACTIONAL_EMAIL_FROM', 'Mandalart <noreply@example.com>')
  vi.stubEnv('JWT_SECRET', 'local-email-test-secret-with-at-least-32-characters')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it.each([
  ['development', 'false', true],
  ['production', 'true', true],
  ['production', 'false', false],
] as const)('sends purchase and sign-in emails with correct routing in %s (local database: %s)', async (environment, localDatabase, simulated) => {
  vi.stubEnv('NODE_ENV', environment)
  vi.stubEnv('LOCAL_DATABASE_ONLY', localDatabase)
  const send = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'email-id' }) })
  vi.stubGlobal('fetch', send)

  await sendAccessEmail('order-id', 'user-id', 'test@gmail.com')
  await sendRegistrationEmail('user-id', 'test@gmail.com')

  expect(send).toHaveBeenCalledTimes(2)
  for (const [url, options] of send.mock.calls) {
    expect(url).toBe('https://api.resend.com/emails')
    const payload = JSON.parse(options.body)
    if (simulated) {
      expect(payload.to).toEqual([expect.stringMatching(/^delivered\+test-[a-f0-9]{12}@resend\.dev$/)])
      expect(payload.subject).toContain('[TESTE LOCAL: test@gmail.com]')
    } else {
      expect(payload.to).toEqual(['test@gmail.com'])
      expect(payload.subject).not.toContain('TESTE LOCAL')
    }
    expect(payload.html).toContain('http://localhost:3100/finalizar-cadastro?token=')
    expect(payload.html).toContain('Concluir meu cadastro')
  }
  expect(JSON.parse(send.mock.calls[0][1].body).html).toContain('37,00')
  expect(sql.mock.calls.at(2)?.slice(1)).toEqual(['order-id', 'user-id'])
})
