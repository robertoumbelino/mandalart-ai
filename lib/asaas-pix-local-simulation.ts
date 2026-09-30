import 'server-only'
import { billingMode } from '@/lib/stripe'

export function localPixSimulationEnabled(request: Request, mutation = false) {
  if (process.env.NODE_ENV !== 'development' || process.env.LOCAL_DATABASE_ONLY !== 'true' ||
    process.env.ASAAS_PIX_LOCAL_SIMULATION !== 'true' || billingMode() !== 'test') return false
  const databaseHost = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : ''
  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseHost)) return false
  const host = request.headers.get('host') || ''
  if (!['localhost:3000', '127.0.0.1:3000'].includes(host)) return false
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost && forwardedHost !== host) return false
  if (mutation && request.headers.get('origin') !== `http://${host}`) return false
  return true
}
