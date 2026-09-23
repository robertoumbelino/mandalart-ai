import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateText } from 'ai'
import { generatePreview, preparePreview } from './onboarding-server'
import { classifyGoalSafety } from './goal-safety'
import { getDb } from './db'

vi.mock('server-only', () => ({}))
vi.mock('./db', () => ({ getDb: vi.fn() }))
vi.mock('./goal-safety', () => ({ classifyGoalSafety: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn() })),
  headers: vi.fn(async () => new Headers())
}))
vi.mock('ai', async () => ({
  ...(await vi.importActual<typeof import('ai')>('ai')),
  generateText: vi.fn()
}))

const answers = {
  category: 'learning',
  dream: 'Aprender um idioma',
  stage: 'idea',
  obstacle: 'direction',
  time: 'one',
  horizon: 'quarter',
  customDream: ''
} as const
const preview = {
  title: 'Aprender um idioma',
  introduction:
    'Um caminho que começa com poucos minutos na sua semana, para escolher onde você quer chegar.',
  pillars: Array.from({ length: 8 }, (_, i) => ({
    title: `Pilar ${i + 1}`,
    description: 'Uma parte importante do plano para aprender.'
  })),
  firstStep: {
    title: 'Escolher o idioma',
    description: 'Defina o idioma e uma situação em que você quer usá-lo.',
    minutes: 15,
    checklist: [
      'Escolha o idioma que quer aprender.',
      'Anote uma situação para usar o idioma.',
      'Reserve 15 minutos na sua semana.'
    ]
  }
}

describe('anonymous preview generation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('JWT_SECRET', 'test-secret-only-never-used-in-production-12345')
  })
  it('generates only the preview for curated goals, without a redundant classification call', async () => {
    vi.mocked(generateText).mockResolvedValue({ output: preview } as never)
    expect(await generatePreview(answers)).toEqual({ status: 'ready', preview })
    expect(classifyGoalSafety).not.toHaveBeenCalled()
    expect(generateText).toHaveBeenCalledTimes(1)
  })
  it.each(['illegal', 'self_harm'] as const)(
    'screens free text and blocks %s before generation',
    async (classification) => {
      vi.mocked(classifyGoalSafety).mockResolvedValue(classification)
      expect(
        await generatePreview({
          ...answers,
          dream: 'other',
          customDream: 'Objetivo de teste'
        })
      ).toEqual({
        status: 'blocked',
        category: classification === 'self_harm' ? 'self-harm' : 'illegal'
      })
      expect(generateText).not.toHaveBeenCalled()
    }
  )
  it('preserves allowed custom goals in the model context', async () => {
    vi.mocked(classifyGoalSafety).mockResolvedValue('allowed')
    vi.mocked(generateText).mockResolvedValue({ output: preview } as never)
    await generatePreview({
      ...answers,
      dream: 'other',
      customDream: 'Construir um pequeno jardim'
    })
    expect(vi.mocked(generateText).mock.calls[0][0].prompt).toContain(
      'Construir um pequeno jardim'
    )
  })
  it('never returns malformed model output as a successful preview', async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: { ...preview, pillars: [] }
    } as never)
    await expect(generatePreview(answers)).rejects.toThrow()
  })
  it('returns an existing preview without spending on another generation', async () => {
    const query = vi.fn().mockResolvedValue([{ id: 'existing', preview }])
    vi.mocked(getDb).mockReturnValue(query as never)
    expect(await preparePreview(answers, {})).toEqual({
      status: 'ready',
      id: 'existing',
      preview
    })
    expect(generateText).not.toHaveBeenCalled()
    expect(query).toHaveBeenCalledTimes(1)
  })
  it('stops before reservation and generation when the durable usage limit is reached', async () => {
    const query = vi
      .fn()
      .mockResolvedValue([{ count: 1001 }])
      .mockResolvedValueOnce([])
    vi.mocked(getDb).mockReturnValue(query as never)
    expect((await preparePreview(answers, {})).status).toBe('error')
    expect(generateText).not.toHaveBeenCalled()
    expect(query).toHaveBeenCalledTimes(3)
  })
  it('does not start a second generation when another request owns the reservation', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([])
    vi.mocked(getDb).mockReturnValue(query as never)
    expect(await preparePreview(answers, {})).toMatchObject({
      status: 'error',
      retryAfter: 10
    })
    expect(generateText).not.toHaveBeenCalled()
  })
})
