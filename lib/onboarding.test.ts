import { describe, expect, it } from 'vitest'
import {
  answersKey,
  answersSchema,
  CATEGORIES,
  DRAFT_LIFETIME,
  getAnswerContext,
  isStepComplete,
  previewSchema,
  restoreDraft
} from './onboarding'

const answers = {
  category: 'learning',
  dream: 'Aprender um idioma',
  stage: 'idea',
  obstacle: 'direction',
  time: 'one',
  horizon: 'quarter',
  customDream: ''
} as const
export const examplePreview = {
  title: 'Aprender um novo idioma',
  introduction:
    'Vamos começar com uma rotina pequena, que caiba na sua semana e ajude a escolher por onde seguir.',
  pillars: Array.from({ length: 8 }, (_, i) => ({
    title: `Pilar ${i + 1}`,
    description: 'Um pilar específico para organizar este objetivo.'
  })),
  firstStep: {
    title: 'Escolha seu idioma',
    description: 'Escolha o idioma e uma situação em que você quer usá-lo.',
    minutes: 15,
    checklist: [
      'Escolher um idioma para aprender.',
      'Anotar uma situação para praticar.',
      'Reservar um bloco de 15 minutos.'
    ]
  }
}
const now = Date.now()
const draft = {
  version: 1,
  savedAt: now,
  screen: 'preview',
  question: 5,
  answers,
  result: {
    id: '123e4567-e89b-12d3-a456-426614174000',
    preview: examplePreview,
    answersKey: answersKey(answers)
  },
  checked: [true, false, false],
  attribution: { ref: 'test' },
  pack: 1
}

describe('onboarding boundaries', () => {
  it('accepts all curated dreams in their own categories', () => {
    for (const category of CATEGORIES)
      for (const dream of category.dreams) {
        expect(
          answersSchema.safeParse({ ...answers, category: category.id, dream })
            .success
        ).toBe(true)
      }
  })
  it('rejects a dream from another category and incomplete answers', () => {
    expect(
      answersSchema.safeParse({ ...answers, category: 'money' }).success
    ).toBe(false)
    expect(
      answersSchema.safeParse({ ...answers, time: undefined }).success
    ).toBe(false)
  })
  it('requires meaningful free text only for the other-dream branch', () => {
    expect(
      answersSchema.safeParse({
        ...answers,
        dream: 'other',
        customDream: '    '
      }).success
    ).toBe(false)
    expect(isStepComplete({ dream: 'other', customDream: ' oi ' }, 1)).toBe(
      false
    )
    expect(
      answersSchema.safeParse({
        ...answers,
        dream: 'other',
        customDream: ' Fazer um jardim '
      }).success
    ).toBe(true)
    expect(
      answersSchema.safeParse({
        ...answers,
        dream: 'other',
        customDream: 'a'.repeat(301)
      }).success
    ).toBe(false)
  })
  it('does not send hidden, unused free text to the model or split the cache', () => {
    const withUnusedText = {
      ...answers,
      customDream: 'Unused personal information'
    }
    expect(answersKey(withUnusedText)).toBe(answersKey(answers))
    expect(JSON.stringify(getAnswerContext(withUnusedText))).not.toContain(
      'Unused'
    )
  })
  it('requires exactly eight pillars and three actionable checklist items', () => {
    expect(previewSchema.safeParse(examplePreview).success).toBe(true)
    expect(
      previewSchema.safeParse({
        ...examplePreview,
        pillars: examplePreview.pillars.slice(0, 7)
      }).success
    ).toBe(false)
    expect(
      previewSchema.safeParse({
        ...examplePreview,
        firstStep: { ...examplePreview.firstStep, checklist: ['Only one'] }
      }).success
    ).toBe(false)
  })
})

describe('recovering the journey', () => {
  it('preserves an unchanged preview and its checklist', () => {
    const restored = restoreDraft(draft, now)
    expect(restored?.screen).toBe('preview')
    expect(restored?.checked).toEqual([true, false, false])
  })
  it('invalidates a preview when the answers change', () => {
    const restored = restoreDraft(
      { ...draft, answers: { ...answers, time: 'more' } },
      now
    )
    expect(restored?.result).toBeNull()
    expect(restored?.screen).toBe('questions')
    expect(restored?.checked).toEqual([false, false, false])
  })
  it('recovers interrupted generation without automatically spending on another call', () => {
    const restored = restoreDraft(
      { ...draft, screen: 'generating', result: null },
      now
    )
    expect(restored?.screen).toBe('questions')
    expect(restored?.question).toBe(5)
  })
  it('cannot jump beyond the first missing answer', () => {
    const restored = restoreDraft(
      { ...draft, screen: 'questions', answers: { category: 'learning' } },
      now
    )
    expect(restored?.question).toBe(1)
    expect(restored?.result).toBeNull()
  })
  it('rejects invalid and expired browser data', () => {
    expect(restoreDraft({ ...draft, version: 999 }, now)).toBeNull()
    expect(
      restoreDraft({ ...draft, savedAt: now - DRAFT_LIFETIME - 1 }, now)
    ).toBeNull()
    expect(restoreDraft({ ...draft, savedAt: now + 100 }, now)).toBeNull()
    expect(restoreDraft({ ...draft, checked: [] }, now)).toBeNull()
  })
})
