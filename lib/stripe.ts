import 'server-only'
import Stripe from 'stripe'

export function billingMode(): 'test' | 'live' {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || !/^(sk|rk)_(test|live)_/.test(key))
    throw new Error('Pagamentos ainda não configurados.')
  const mode = key.includes('_test_') ? 'test' : 'live'
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
export function getStripe() {
  billingMode()
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    maxNetworkRetries: 2,
    timeout: 20_000,
  })
}
export function billingConfig() {
  return { mode: billingMode(), pix: process.env.STRIPE_PIX_ENABLED === 'true' }
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
