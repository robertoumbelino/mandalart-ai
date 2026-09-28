import { afterEach, describe, expect, it, vi } from 'vitest'
import { allowedLocalEmailRecipient, localEmailTestMode } from './email-testing'

afterEach(() => vi.unstubAllEnvs())

describe('local email test guard', () => {
  it('accepts only Resend simulation addresses', () => {
    expect(allowedLocalEmailRecipient('delivered@resend.dev')).toBe(true)
    expect(allowedLocalEmailRecipient('BOUNCED@RESEND.DEV')).toBe(true)
    expect(allowedLocalEmailRecipient('complained@resend.dev')).toBe(true)
    expect(allowedLocalEmailRecipient('buyer@example.com')).toBe(false)
    expect(allowedLocalEmailRecipient('delivered@resend.dev.evil.com')).toBe(false)
  })

  it('stays active for a local database even under a production build', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LOCAL_DATABASE_ONLY', 'true')
    expect(localEmailTestMode()).toBe(true)
  })

  it('does not limit the deployed production environment', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LOCAL_DATABASE_ONLY', 'false')
    expect(localEmailTestMode()).toBe(false)
  })
})
