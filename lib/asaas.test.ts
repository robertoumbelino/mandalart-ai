import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { directAsaasPixEnabled, getAsaasPixPayments } from './asaas'

const pixKey = '11111111-2222-3333-4444-555555555555'

describe('Asaas direct Pix environment gates', () => {
  beforeEach(() => {
    vi.stubEnv('PAYMENT_PROVIDER', 'asaas')
    vi.stubEnv('ASAAS_DIRECT_PIX_ENABLED', 'true')
    vi.stubEnv('ASAAS_PIX_KEY', pixKey)
    vi.stubEnv('LOCAL_DATABASE_ONLY', 'false')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('keeps direct Pix available in the Sandbox', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('VERCEL_ENV', undefined)
    vi.stubEnv('ASAAS_API_KEY', '$aact_hmlg_fixture')
    expect(directAsaasPixEnabled()).toBe(true)
  })

  it('enables direct Pix with a live key and the production Pix key', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('ASAAS_API_KEY', '$aact_prod_fixture')
    expect(directAsaasPixEnabled()).toBe(true)
  })

  it('rejects a Sandbox API key on the production deployment', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('ASAAS_API_KEY', '$aact_hmlg_fixture')
    expect(() => directAsaasPixEnabled()).toThrow('Produção exige pagamentos reais')
  })

  it('stays disabled without an explicit flag and a valid Pix key', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('ASAAS_API_KEY', '$aact_prod_fixture')
    vi.stubEnv('ASAAS_DIRECT_PIX_ENABLED', 'false')
    expect(directAsaasPixEnabled()).toBe(false)
    vi.stubEnv('ASAAS_DIRECT_PIX_ENABLED', 'true')
    vi.stubEnv('ASAAS_PIX_KEY', 'sandbox-placeholder')
    expect(directAsaasPixEnabled()).toBe(false)
  })

  it('accepts a filtered Pix list without the QR ID field; the payment detail is validated later', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ASAAS_API_KEY', '$aact_hmlg_fixture')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: [{ id: 'pay_123' }], hasMore: false }))

    await expect(getAsaasPixPayments('qr_123')).resolves.toEqual([{ id: 'pay_123' }])
  })
})
