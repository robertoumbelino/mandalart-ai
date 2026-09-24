import { beforeEach, expect, it, vi } from 'vitest'
import { loadPaidPreview } from './paid-preview'
import {
  CATEGORIES,
  STAGES,
  OBSTACLES,
  TIME_OPTIONS,
  HORIZONS,
} from './onboarding'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({ sql: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.sql }))
vi.mock('@/lib/onboarding-server', () => ({ getPreviewSession: mocks.session }))
const id = 'b857878a-22e1-4190-a04f-611d6e03d2a0'
const visitor = 'd595d842-62f4-409f-99a4-d452e4dbf67d'
const answers = {
  category: CATEGORIES[0].id,
  dream: CATEGORIES[0].dreams[0],
  stage: STAGES[0].id,
  obstacle: OBSTACLES[0].id,
  time: TIME_OPTIONS[0].id,
  horizon: HORIZONS[0].id,
}
const preview = {
  title: 'Um começo possível',
  introduction: 'Um caminho para o seu objetivo de agora.',
  pillars: Array.from({ length: 8 }, (_, i) => ({
    title: `Pilar ${i + 1}`,
    description: 'Descrição do pilar original.',
  })),
  firstStep: {
    title: 'Primeiro passo',
    description: 'Uma ação concreta para começar.',
    minutes: 10,
    checklist: ['Primeira ação', 'Segunda ação', 'Terceira ação'],
  },
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue(visitor)
  mocks.sql.mockResolvedValue([{ answers, preview }])
})
it('loads the authoritative preview scoped to the signed visitor session', async () => {
  expect(await loadPaidPreview(id, answers.dream)).toEqual(preview)
  const [sql, ...values] = mocks.sql.mock.calls[0]
  expect(sql.join('')).toContain('session_id=')
  expect(sql.join('')).toContain("status='ready' AND expires_at>now()")
  expect(values).toEqual([id, visitor])
})
it('rejects a missing, foreign or expired preview', async () => {
  mocks.sql.mockResolvedValue([])
  await expect(loadPaidPreview(id, answers.dream)).rejects.toThrow(
    'Prévia indisponível',
  )
})
it('rejects a preview for another dream', async () => {
  await expect(loadPaidPreview(id, 'Outro objetivo')).rejects.toThrow(
    'Prévia indisponível',
  )
})
