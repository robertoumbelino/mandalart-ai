import 'server-only'
import Stripe from 'stripe'
import { localEmailTestMode } from '@/lib/email-testing'

export function paymentProvider(): 'asaas' | 'stripe' {
  const configured = process.env.PAYMENT_PROVIDER
  if (configured && configured !== 'asaas' && configured !== 'stripe')
    throw new Error('Provedor de pagamentos inválido.')
  return configured === 'asaas' || configured === 'stripe'
    ? configured
    : process.env.ASAAS_API_KEY ? 'asaas' : 'stripe'
}

function checkedMode(key: string | undefined, pattern: RegExp): 'test' | 'live' {
  if (!key || !pattern.test(key))
    throw new Error('Pagamentos ainda não configurados.')
  const mode = key.includes('_test_') || key.startsWith('$aact_hmlg_') ? 'test' : 'live'
  if (
    mode === 'live' &&
    (process.env.NODE_ENV !== 'production' ||
      process.env.LOCAL_DATABASE_ONLY === 'true' ||
      (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production'))
  ) {
    throw new Error('Pagamentos reais estão bloqueados neste ambiente.')
  }
  if (mode === 'test' && process.env.VERCEL_ENV === 'production')
    throw new Error('Produção exige pagamentos reais. Chave de teste bloqueada.')
  return mode
}

export function stripeMode(): 'test' | 'live' {
  return checkedMode(process.env.STRIPE_SECRET_KEY, /^(sk|rk)_(test|live)_/)
}

export function billingMode(): 'test' | 'live' {
  return paymentProvider() === 'asaas'
    ? checkedMode(process.env.ASAAS_API_KEY, /^\$aact_(hmlg|prod)_/)
    : stripeMode()
}
export function getStripe() {
  stripeMode()
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    maxNetworkRetries: 2,
    timeout: 20_000,
  })
}
export function billingConfig() {
  return { mode: billingMode(), pix: paymentProvider() === 'asaas' || process.env.STRIPE_PIX_ENABLED === 'true' }
}
export function billingOrigin() {
  const mode = billingMode()
  if (mode === 'live' && !process.env.APP_URL)
    throw new Error('APP_URL deve ser configurada em produção.')
  const url = new URL(process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'))
  if (mode === 'live' && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
    throw new Error('APP_URL deve usar HTTPS em produção.')
  return url.origin
}

export function emailOrigin() {
  if (!localEmailTestMode()) return billingOrigin()
  const url = new URL(process.env.LOCAL_APP_URL || 'http://localhost:3000')
  if (!['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username || url.password)
    throw new Error('LOCAL_APP_URL deve apontar para o servidor local.')
  return url.origin
}
