import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateText } from 'ai'
import { generateMandalartData, generateQuestions } from './ai'

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

    await expect(generateMandalartData('Objetivo de teste válido', answers))
      .rejects.toThrow('Objetivo bloqueado pela verificação de segurança.')
    expect(generateTextMock).toHaveBeenCalledTimes(1)
  })
})
