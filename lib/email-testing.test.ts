import { afterEach, describe, expect, it, vi } from 'vitest'
import { allowedLocalEmailRecipient, emailDeliveryRecipient, localEmailTestMode } from './email-testing'

afterEach(() => vi.unstubAllEnvs())

describe('local email test guard', () => {
  it('routes arbitrary local recipients to distinct, stable Resend simulations', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const recipient = emailDeliveryRecipient('test@gmail.com')
    expect(recipient).toMatch(/^delivered\+test-[a-f0-9]{12}@resend\.dev$/)
    expect(emailDeliveryRecipient(' TEST@gmail.com ')).toBe(recipient)
    expect(emailDeliveryRecipient('test@example.com')).not.toBe(recipient)
    expect(emailDeliveryRecipient('delivered@resend.dev.evil.com')).toMatch(/@resend\.dev$/)
    expect(emailDeliveryRecipient('bounced+checkout@resend.dev')).toBe('bounced+checkout@resend.dev')
  })

  it('accepts only Resend simulation addresses', () => {
    expect(allowedLocalEmailRecipient('delivered@resend.dev')).toBe(true)
    expect(allowedLocalEmailRecipient('delivered+conversion@resend.dev')).toBe(true)
    expect(allowedLocalEmailRecipient('delivered+conversion@resend.dev.evil.com')).toBe(false)
    expect(allowedLocalEmailRecipient('someone+delivered@resend.dev')).toBe(false)
    expect(allowedLocalEmailRecipient('BOUNCED@RESEND.DEV')).toBe(true)
    expect(allowedLocalEmailRecipient('complained@resend.dev')).toBe(true)
    expect(allowedLocalEmailRecipient('buyer@example.com')).toBe(false)
    expect(allowedLocalEmailRecipient('delivered@resend.dev.evil.com')).toBe(false)
  })

  it('stays active for a local database even under a production build', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LOCAL_DATABASE_ONLY', 'true')
    expect(localEmailTestMode()).toBe(true)
    expect(emailDeliveryRecipient('buyer@example.com')).toMatch(/@resend\.dev$/)
  })

  it('does not limit the deployed production environment', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LOCAL_DATABASE_ONLY', 'false')
    expect(localEmailTestMode()).toBe(false)
    expect(emailDeliveryRecipient('buyer@example.com')).toBe('buyer@example.com')
  })
})
