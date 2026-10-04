import { z } from 'zod'
import { answersSchema, CATEGORIES, DRAFT_LIFETIME, getDream, HORIZONS, OBSTACLES } from './onboarding'

export const SALES_JOURNEY_VERSION = 'sales-v3'
export const SALES_DRAFT_KEY = 'mandalart.sales.v3'
export const SALES_FIELDS = ['category', 'dream', 'obstacle', 'horizon'] as const
export const salesAnswersSchema = z.object({
  journeyVersion: z.literal(SALES_JOURNEY_VERSION),
  category: answersSchema.shape.category,
  dream: answersSchema.shape.dream,
  customDream: answersSchema.shape.customDream,
  obstacle: answersSchema.shape.obstacle,
  horizon: answersSchema.shape.horizon,
}).refine(data => data.dream === 'other'
  ? data.customDream.trim().length >= 5
  : CATEGORIES.find(item => item.id === data.category)?.dreams.some(dream => dream === data.dream),
{ message: 'Escolha um objetivo ou escreva pelo menos 5 caracteres.', path: ['dream'] })
export type SalesAnswers = z.infer<typeof salesAnswersSchema>
export type SalesDraftAnswers = Partial<SalesAnswers>

export function salesStepComplete(answers: SalesDraftAnswers, step: number) {
  if (step === 0) return CATEGORIES.some(item => item.id === answers.category)
  if (step === 1) return answers.dream === 'other'
    ? (answers.customDream?.trim().length ?? 0) >= 5 && (answers.customDream?.length ?? 0) <= 300
    : CATEGORIES.find(item => item.id === answers.category)?.dreams.some(dream => dream === answers.dream) ?? false
  return (step === 2 ? OBSTACLES : step === 3 ? HORIZONS : []).some(item => item.id === answers[SALES_FIELDS[step]])
}
export function salesTitle(answers: SalesDraftAnswers) {
  const periods = { month: 'de 30 dias ', quarter: 'de 3 meses ', semester: 'de 6 meses ', open: '' }
  const dream = getDream(answers)
  return `Seu plano ${periods[answers.horizon as keyof typeof periods] || ''}para ${dream.charAt(0).toLowerCase()}${dream.slice(1)}`
}
export const OBSTACLE_PROMISES = {
  direction: 'A primeira tarefa já está definida',
  time: 'Tarefas de até 20 minutos',
  resources: 'Cada etapa diz o que usar',
  consistency: 'Uma tarefa por vez, progresso salvo',
  choices: 'A ordem já está definida',
} as const
export function salesInterviewContext(answers: SalesAnswers) {
  return [
    { questionId: 'sales-category', questionText: 'Qual área importa mais agora?', answer: CATEGORIES.find(item => item.id === answers.category)!.title },
    { questionId: 'sales-obstacle', questionText: 'O que torna o próximo passo mais difícil?', answer: OBSTACLES.find(item => item.id === answers.obstacle)!.title },
    { questionId: 'sales-horizon', questionText: 'Quando você quer ver os primeiros avanços?', answer: HORIZONS.find(item => item.id === answers.horizon)!.title },
  ]
}
const salesDraftSchema = z.object({
  version: z.literal(3), attemptId: z.uuid(), savedAt: z.number(),
  screen: z.enum(['questions', 'processing', 'closing', 'checkout']),
  question: z.number().int().min(0).max(3),
  answers: z.object(salesAnswersSchema.shape).partial(), intentId: z.uuid().nullable(),
})
export type SalesDraft = z.infer<typeof salesDraftSchema>
export function restoreSalesDraft(value: unknown, now = Date.now()): SalesDraft | null {
  const parsed = salesDraftSchema.safeParse(value)
  if (!parsed.success || now - parsed.data.savedAt > DRAFT_LIFETIME || parsed.data.savedAt > now) return null
  const draft = parsed.data
  const missing = SALES_FIELDS.findIndex((_, step) => !salesStepComplete(draft.answers, step))
  if (missing >= 0) {
    draft.screen = 'questions'
    draft.question = Math.min(draft.question, missing)
    draft.intentId = null
  } else if (draft.screen === 'processing') draft.screen = 'closing'
  return draft
}
