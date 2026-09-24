import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { billingMode, billingOrigin } from './stripe'

describe('Stripe environment isolation', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LOCAL_DATABASE_ONLY', 'false')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('VERCEL_URL', 'preview.example.com')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_live_fixture')
    vi.stubEnv('APP_URL', 'https://mandalart-ai.vercel.app')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('uses real payments and the canonical return origin in production', () => {
    expect(billingMode()).toBe('live')
    expect(billingOrigin()).toBe('https://mandalart-ai.vercel.app')
  })
  it('rejects test payments on the production deployment', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture')
    expect(() => billingMode()).toThrow('Chave de teste bloqueada')
  })
  it('rejects real payments on preview deployments even with a production build', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(() => billingMode()).toThrow('Pagamentos reais estão bloqueados')
  })
  it('rejects real payments during local development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERCEL_ENV', undefined)
    expect(() => billingMode()).toThrow('Pagamentos reais estão bloqueados')
  })
  it('rejects real payments in a local production build', () => {
    vi.stubEnv('VERCEL_ENV', undefined)
    vi.stubEnv('LOCAL_DATABASE_ONLY', 'true')
    expect(() => billingMode()).toThrow('Pagamentos reais estão bloqueados')
  })
  it('retains localhost as the local test checkout return', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERCEL_ENV', undefined)
    vi.stubEnv('VERCEL_URL', undefined)
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture')
    vi.stubEnv('APP_URL', undefined)
    expect(billingMode()).toBe('test')
    expect(billingOrigin()).toBe('http://localhost:3000')
  })
  it('returns test checkouts to their preview deployment when configured there', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_fixture')
    vi.stubEnv('APP_URL', undefined)
    expect(billingOrigin()).toBe('https://preview.example.com')
  })
  it.each([undefined, 'http://mandalart-ai.vercel.app', 'https://localhost:3000'])('rejects an invalid live return origin: %s', (url) => {
    vi.stubEnv('APP_URL', url)
    expect(() => billingOrigin()).toThrow('APP_URL')
  })
})
