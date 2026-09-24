import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateText } from 'ai'
import { generateQuestions } from './ai'
import { buildMandalartData } from '@/lib/plan-generation'
import { mandalartDataSchema } from '@/lib/validation'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/credits', () => ({ creditBalance: vi.fn().mockResolvedValue(1) }))

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return { ...actual, generateText: vi.fn() }
})

vi.mock('@/actions/auth', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'test-user' })
}))

const generateTextMock = vi.mocked(generateText)

describe('goal safety screening', () => {
  beforeEach(() => {
    generateTextMock.mockReset()
  })

  it.each([
    ['illegal', 'illegal'],
    ['self_harm', 'self-harm']
  ] as const)('blocks %s goals before generating questions', async (classification, category) => {
    generateTextMock.mockResolvedValueOnce({ output: { classification } } as never)

    await expect(generateQuestions('Objetivo de teste válido')).resolves.toEqual({
      status: 'blocked',
      category
    })
    expect(generateTextMock).toHaveBeenCalledTimes(1)
  })

  it('generates questions only after an allowed classification', async () => {
    const questions = Array.from({ length: 3 }, (_, index) => ({
      id: String(index + 1),
      text: `Pergunta ${index + 1}?`
    }))
    generateTextMock
      .mockResolvedValueOnce({ output: { classification: 'allowed' } } as never)
      .mockResolvedValueOnce({ output: { questions } } as never)

    await expect(generateQuestions('Correr uma maratona')).resolves.toEqual({
      status: 'allowed',
      questions
    })
    expect(generateTextMock).toHaveBeenCalledTimes(2)
  })

  it('rechecks safety before generating the final Mandalart', async () => {
    generateTextMock.mockResolvedValueOnce({ output: { classification: 'illegal' } } as never)
    const answers = Array.from({ length: 3 }, (_, index) => ({
      questionId: String(index + 1),
      questionText: `Pergunta ${index + 1}?`,
      answer: `Resposta ${index + 1}`
    }))

    await expect(buildMandalartData('Objetivo de teste válido', answers))
      .rejects.toThrow('Objetivo bloqueado pela verificação de segurança.')
    expect(generateTextMock).toHaveBeenCalledTimes(1)
  })
})

it('preserves the purchased preview pillars and first action when expanding it', async () => {
  const preview = {
    title: 'Começar um novo idioma', introduction: 'Um caminho possível para estudar no seu ritmo.',
    pillars: Array.from({ length: 8 }, (_, i) => ({ title: `Pilar da prévia ${i + 1}`, description: 'Descrição original do pilar.' })),
    firstStep: { title: 'Meu primeiro passo original', description: 'A descrição do primeiro passo que foi apresentada na prévia.', minutes: 15, checklist: ['A'.repeat(150), 'Ação original dois', 'Ação original três'] }
  }
  const generated = { mainGoal: 'Aprender um idioma', subGoals: Array.from({ length: 8 }, () => ({ title: 'Título reescrito', description: 'Descrição reescrita', advice: 'Uma orientação concreta.', tasks: Array.from({ length: 8 }, () => ({ title: 'Uma tarefa prática', description: 'Faça a tarefa com atenção.', advice: 'Reserve tempo para praticar.', checklist: ['Primeira ação', 'Segunda ação', 'Terceira ação'] })) })) }
  generateTextMock.mockReset()
  generateTextMock.mockResolvedValueOnce({ output: { classification: 'allowed' } } as never).mockResolvedValueOnce({ output: generated } as never)
  const result = await buildMandalartData('Aprender um idioma', Array.from({ length: 3 }, (_, i) => ({ questionId: String(i), questionText: 'Pergunta válida?', answer: 'Resposta válida.' })), preview)
  expect(result.subGoals.map(p => p.title)).toEqual(preview.pillars.map(p => p.title))
  expect(result.subGoals[0].tasks[0].title).toBe(preview.firstStep.title)
  expect(result.subGoals[0].tasks[0].checklist.map(c => c.text)).toEqual(preview.firstStep.checklist)
  expect(result.subGoals.flatMap(p => p.tasks)).toHaveLength(64)
  expect(() => mandalartDataSchema.parse(result)).not.toThrow()
})
