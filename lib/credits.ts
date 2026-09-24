import 'server-only'
import { getDb } from '@/lib/db'
import { billingMode } from '@/lib/stripe'
import type { HistoryItem } from '@/types'

export async function creditBalance(userId: string) {
  const [row] =
    await getDb()`SELECT dream_release_expired(${userId}::uuid,${billingMode()}) AS balance`
  return Number(row.balance)
}
export async function reserveDream(userId: string, id: string, hash: string) {
  const [row] =
    await getDb()`SELECT dream_reserve(${userId}::uuid,${billingMode()},${id}::uuid,${hash}) AS reservation`
  return row.reservation as {
    status: 'reserved' | 'generating' | 'completed' | 'failed' | 'insufficient'
    result?: HistoryItem
  }
}
export async function failDream(userId: string, id: string) {
  await getDb()`SELECT dream_fail(${userId}::uuid,${billingMode()},${id}::uuid)`
}
export async function completeDream(
  userId: string,
  id: string,
  data: HistoryItem['data'],
) {
  const [row] =
    await getDb()`SELECT dream_complete(${userId}::uuid,${billingMode()},${id}::uuid,${JSON.stringify(data)}::jsonb) AS result`
  return row.result as HistoryItem | null
}
