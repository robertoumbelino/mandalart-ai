'use server'

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { cleanAttribution } from '@/lib/attribution'
import { getPreviewSession } from '@/lib/onboarding-server'
import { salesAnswersSchema } from '@/lib/sales-journey'
import { startGuestCheckout, startGuestPix } from './onboarding-checkout'

const schema = z.object({
  answers: salesAnswersSchema, attemptId: z.uuid(), orderId: z.uuid(),
  method: z.enum(['pix', 'card', 'kiwify']), email: z.email().max(254).optional(),
  attribution: z.record(z.string(), z.unknown()).default({}),
  analyticsDistinctId: z.string().min(1).max(200).optional(), marketingConsent: z.boolean().default(false),
})

// Reuse payment/session ownership and fulfillment; this record contains quiz answers only.
// No AI, generated preview, or credit is created before payment.
export async function startSalesCheckout(raw: unknown) {
  const input = schema.parse(raw)
  if (input.method === 'pix' && !input.email) throw new Error('Informe um e-mail para receber seu acesso.')
  const sessionId = await getPreviewSession()
  const sql = getDb()
  const hash = createHash('sha256').update(JSON.stringify({ answers: input.answers, attemptId: input.attemptId })).digest('hex')
  const [limit] = await sql`SELECT count(*)::int AS n FROM onboarding_previews WHERE session_id=${sessionId}::uuid AND created_at>now()-interval '1 hour'`
  if (Number(limit.n) >= 20) throw new Error('Aguarde um pouco antes de iniciar uma nova compra.')
  const [intent] = await sql`INSERT INTO onboarding_previews(session_id,input_hash,answers,attribution,status)
    VALUES(${sessionId}::uuid,${hash},${JSON.stringify(input.answers)}::jsonb,${JSON.stringify(cleanAttribution(input.attribution))}::jsonb,'ready')
    ON CONFLICT(session_id,input_hash) DO UPDATE SET expires_at=now()+interval '7 days',updated_at=now()
    RETURNING id`
  const intentId = String(intent.id)
  const context = { analyticsDistinctId: input.analyticsDistinctId, marketingConsent: input.marketingConsent }
  const result = input.method === 'pix'
    ? await startGuestPix(intentId, input.orderId, input.email!, context)
    : await startGuestCheckout(intentId, input.orderId, context, input.method === 'kiwify' ? 'kiwify' : 'default')
  return { ...result, intentId }
}
