'use server'

import { createHash } from 'node:crypto'
import { getCurrentUser } from '@/actions/auth'
import { billingConfig, billingMode } from '@/lib/stripe'
import { getDb } from '@/lib/db'
import {
  creditBalance,
  reserveDream,
  completeDream,
  failDream,
} from '@/lib/credits'
import { loadPaidPreview } from '@/lib/paid-preview'
import { buildMandalartData } from '@/lib/plan-generation'
import {
  goalSchema,
  idSchema,
  interviewAnswerSchema,
  mandalartDataSchema,
} from '@/lib/validation'
import type { HistoryItem, InterviewAnswer } from '@/types'

async function requireUser() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para continuar.')
  return user
}
export async function getDreamWallet() {
  const user = await requireUser()
  const balance = await creditBalance(user.id)
  const transactions =
    await getDb()`SELECT delta,reason,created_at FROM dream_credit_ledger WHERE user_id=${user.id} AND mode=${billingMode()} ORDER BY created_at DESC LIMIT 20`
  return {
    balance,
    ...billingConfig(),
    transactions: transactions.map((row) => ({
      delta: Number(row.delta),
      reason: String(row.reason),
      date: new Date(row.created_at as string).toISOString(),
    })),
  }
}
export type GenerationResponse =
  | { status: 'completed'; item: HistoryItem }
  | { status: 'generating' | 'failed' | 'insufficient'; message: string }

export async function getDreamGeneration(
  rawId: string,
): Promise<GenerationResponse> {
  const user = await requireUser()
  const id = idSchema.parse(rawId)
  await creditBalance(user.id)
  const [row] =
    await getDb()`SELECT status,result FROM dream_generations WHERE id=${id}::uuid AND user_id=${user.id} AND mode=${billingMode()}`
  if (row?.status === 'completed')
    return { status: 'completed', item: row.result as HistoryItem }
  if (row?.status === 'generating')
    return {
      status: 'generating',
      message: 'Seu planner está sendo preparado.',
    }
  return {
    status: 'failed',
    message:
      'A geração não foi concluída. Seu sonho está disponível para tentar de novo.',
  }
}
export async function generateDream(
  rawId: string,
  rawGoal: string,
  rawAnswers: InterviewAnswer[],
  rawPreviewId?: string,
): Promise<GenerationResponse> {
  const user = await requireUser()
  const id = idSchema.parse(rawId)
  const goal = goalSchema.parse(rawGoal)
  const answers = interviewAnswerSchema.array().length(3).parse(rawAnswers)
  const previewId = rawPreviewId ? idSchema.parse(rawPreviewId) : undefined
  const hash = createHash('sha256')
    .update(JSON.stringify({ goal, answers, previewId }))
    .digest('hex')
  const reservation = await reserveDream(user.id, id, hash)
  if (reservation.status === 'completed')
    return { status: 'completed', item: reservation.result! }
  if (reservation.status === 'insufficient')
    return {
      status: 'insufficient',
      message:
        'Você precisa de mais um sonho. Escolha seu pacote para continuar.',
    }
  if (reservation.status !== 'reserved') return getDreamGeneration(id)
  try {
    const preview = previewId
      ? await loadPaidPreview(previewId, goal)
      : undefined
    const data = mandalartDataSchema.parse(
      await buildMandalartData(goal, answers, preview),
    )
    const item = await completeDream(user.id, id, data)
    if (item) return { status: 'completed', item }
  } catch (error) {
    console.error('dream_generation_failed', {
      id,
      reason: error instanceof Error ? error.name : 'UnknownError',
      cause:
        error instanceof Error && error.cause instanceof Error
          ? error.cause.name
          : undefined,
    })
    // Só devolve uma reserva ainda pendente. Sucesso persistido nunca é desfeito.
    await failDream(user.id, id)
  }
  return getDreamGeneration(id)
}
