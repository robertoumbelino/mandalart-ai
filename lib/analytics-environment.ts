const PRODUCTION_HOSTS = new Set([
  'mandalart.com.br',
  'www.mandalart.com.br',
  'mandalart-ai.vercel.app',
])

export function isProductionAnalyticsOrigin(origin: string | undefined) {
  if (process.env.NODE_ENV !== 'production' || !origin) return false
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' && !url.port && PRODUCTION_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}
