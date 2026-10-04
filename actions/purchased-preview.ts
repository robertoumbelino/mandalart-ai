'use server'

import { getCurrentUser } from '@/actions/auth'
import { getDb } from '@/lib/db'
import { answersSchema, previewSchema } from '@/lib/onboarding'
import { salesAnswersSchema } from '@/lib/sales-journey'
import { billingMode } from '@/lib/stripe'

export async function getPurchasedPreviewContext() {
  const user = await getCurrentUser()
  if (!user) return null
  const [row] = await getDb()`SELECT p.id,p.answers,p.preview,o.id AS order_id
    FROM dream_orders o JOIN onboarding_previews p ON p.id=o.preview_id
    WHERE o.user_id=${user.id}::uuid AND o.mode=${billingMode()} AND o.paid=true AND o.credited>0 AND p.status='ready'
    ORDER BY o.created_at DESC LIMIT 1`
  if (!row) return null
  const sales = salesAnswersSchema.safeParse(row.answers)
  if (sales.success) return { journeyVersion: 'sales-v3' as const, id: String(row.id), orderId: String(row.order_id), answers: sales.data, preview: null }
  return { journeyVersion: 'conversion-v2' as const, id: String(row.id), orderId: String(row.order_id), answers: answersSchema.parse(row.answers), preview: previewSchema.parse(row.preview) }
}
