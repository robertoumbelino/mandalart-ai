import 'server-only'
import { isProductionAnalyticsOrigin } from './analytics-environment'

// The database order is authoritative. Stable event UUID and timestamp deduplicate retries.
export async function capturePaidOrder(order: {
  id: string; amount: number; credits: number; mode: string; preview_id?: string | null;
  journey_version?: string; analytics_distinct_id?: string | null; attribution?: unknown; purchase_confirmed_at?: Date | string;
}) {
  if (!isProductionAnalyticsOrigin(process.env.APP_URL)
    || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')) return false
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (order.mode !== 'live' || !order.analytics_distinct_id || !token || !host) return false
  const response = await fetch(new URL('/i/v0/e/', host), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ api_key: token, event: 'purchase_completed', uuid: order.id, distinct_id: order.analytics_distinct_id, timestamp: order.purchase_confirmed_at, properties: {
      distinct_id: order.analytics_distinct_id,
      order_id: order.id, preview_id: order.preview_id, amount: order.amount,
      value: order.amount / 100, currency: 'BRL', credits: order.credits,
      ...(typeof order.attribution === 'object' && order.attribution ? order.attribution : {}),
      source: 'server', site_environment: 'production', journey_version: order.journey_version || 'conversion-v2',
    } }),
  })
  if (!response.ok) throw new Error(`Product analytics HTTP ${response.status}`)
  return true
}

export async function captureGeneratedPlan(input: { id: string; orderId: string; mode: string; analyticsDistinctId?: string | null; journeyVersion: string }) {
  if (!isProductionAnalyticsOrigin(process.env.APP_URL) || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')) return false
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (input.mode !== 'live' || !input.analyticsDistinctId || !token || !host) return false
  // Generation UUID is stable across retries and differs from the purchase UUID.
  const response = await fetch(new URL('/i/v0/e/', host), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ api_key: token, event: 'plan_generated', uuid: input.id, distinct_id: input.analyticsDistinctId,
      properties: { order_id: input.orderId, generation_id: input.id, journey_version: input.journeyVersion, site_environment: 'production', source: 'server' } }),
  })
  if (!response.ok) throw new Error(`Product analytics HTTP ${response.status}`)
  return true
}
