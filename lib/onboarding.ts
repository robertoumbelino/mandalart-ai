import { z } from 'zod'

export const CATEGORIES = [
  {
    id: 'money',
    title: 'Dinheiro e conquistas',
    hint: 'Mais tranquilidade, novas possibilidades',
    icon: 'wallet',
    dreams: [
      'Organizar minha vida financeira',
      'Sair das dívidas',
      'Montar uma reserva',
      'Me preparar para comprar minha casa'
    ]
  },
  {
    id: 'career',
    title: 'Trabalho e carreira',
    hint: 'Um próximo capítulo profissional',
    icon: 'briefcase',
    dreams: [
      'Conseguir um novo emprego',
      'Mudar de profissão',
      'Crescer na carreira',
      'Voltar ao mercado de trabalho'
    ]
  },
  {
    id: 'business',
    title: 'Meu próprio negócio',
    hint: 'Dar vida a uma ideia que é sua',
    icon: 'rocket',
    dreams: [
      'Tirar uma ideia do papel',
      'Começar a trabalhar por conta própria',
      'Conquistar os primeiros clientes',
      'Organizar e fazer meu negócio crescer'
    ]
  },
  {
    id: 'wellbeing',
    title: 'Saúde e bem-estar',
    hint: 'Mais espaço para cuidar de você',
    icon: 'leaf',
    dreams: [
      'Criar uma rotina de movimento',
      'Melhorar minha rotina de sono',
      'Cuidar melhor da alimentação',
      'Ter mais espaço para cuidar de mim'
    ]
  },
  {
    id: 'learning',
    title: 'Estudos e aprendizado',
    hint: 'Descobrir do que você é capaz',
    icon: 'book',
    dreams: [
      'Aprender um idioma',
      'Me preparar para uma prova',
      'Desenvolver uma habilidade',
      'Retomar os estudos'
    ]
  },
  {
    id: 'experiences',
    title: 'Viagens e experiências',
    hint: 'Abrir espaço para novas histórias',
    icon: 'compass',
    dreams: [
      'Fazer uma viagem especial',
      'Conhecer outro país',
      'Me preparar para morar fora',
      'Começar um projeto pessoal'
    ]
  }
] as const

export const STAGES = [
  {
    id: 'idea',
    title: 'Ainda está só na minha cabeça.',
    hint: 'E tudo bem. É por aqui que começa.',
    icon: 'cloud'
  },
  {
    id: 'research',
    title: 'Já pesquisei, mas não comecei.',
    hint: 'Quero transformar vontade em movimento.',
    icon: 'search'
  },
  {
    id: 'started',
    title: 'Já comecei e quero avançar.',
    hint: 'Um pouco de direção vai me ajudar.',
    icon: 'sprout'
  },
  {
    id: 'restart',
    title: 'Quero recomeçar.',
    hint: 'Já tentei antes. Agora é um novo momento.',
    icon: 'sunrise'
  }
] as const
export const OBSTACLES = [
  { id: 'direction', title: 'Não sei por onde começar.', icon: 'signpost' },
  { id: 'time', title: 'Minha rotina está cheia.', icon: 'clock' },
  { id: 'resources', title: 'Preciso organizar os recursos.', icon: 'wallet' },
  {
    id: 'consistency',
    title: 'É difícil manter a constância.',
    icon: 'footprints'
  },
  {
    id: 'choices',
    title: 'Fico em dúvida sobre o melhor caminho.',
    icon: 'compass'
  }
] as const
export const TIME_OPTIONS = [
  {
    id: 'one',
    title: 'Até 1 hora por semana',
    hint: 'Pequenos passos já contam.',
    icon: 'seed'
  },
  {
    id: 'three',
    title: 'De 1 a 3 horas por semana',
    hint: 'Um espaço para esse sonho na rotina.',
    icon: 'sprout'
  },
  {
    id: 'five',
    title: 'De 3 a 5 horas por semana',
    hint: 'Quero dedicar um pouco mais de tempo.',
    icon: 'leaf'
  },
  {
    id: 'more',
    title: 'Mais de 5 horas por semana',
    hint: 'Esse sonho é uma prioridade agora.',
    icon: 'sun'
  },
  {
    id: 'unsure',
    title: 'Ainda não sei',
    hint: 'Quero começar aos poucos.',
    icon: 'heart'
  }
] as const
export const HORIZONS = [
  {
    id: 'month',
    title: 'Próximos 30 dias',
    hint: 'Um primeiro impulso.',
    icon: 'sunrise'
  },
  {
    id: 'quarter',
    title: 'Próximos 3 meses',
    hint: 'Construir uma base, passo a passo.',
    icon: 'sprout'
  },
  {
    id: 'semester',
    title: 'Próximos 6 meses',
    hint: 'Dar espaço para o sonho crescer.',
    icon: 'tree'
  },
  {
    id: 'open',
    title: 'Prefiro seguir sem uma data',
    hint: 'O importante é começar.',
    icon: 'infinity'
  }
] as const

export const answerFields = [
  'category',
  'dream',
  'stage',
  'obstacle',
  'time',
  'horizon'
] as const
export type AnswerField = (typeof answerFields)[number]
export type DraftAnswers = Partial<Record<AnswerField | 'customDream', string>>

export const answersSchema = z
  .object({
    category: z.enum([
      'money',
      'career',
      'business',
      'wellbeing',
      'learning',
      'experiences'
    ]),
    dream: z.string().min(1).max(120),
    customDream: z.string().trim().max(300).default(''),
    stage: z.enum(['idea', 'research', 'started', 'restart']),
    obstacle: z.enum([
      'direction',
      'time',
      'resources',
      'consistency',
      'choices'
    ]),
    time: z.enum(['one', 'three', 'five', 'more', 'unsure']),
    horizon: z.enum(['month', 'quarter', 'semester', 'open'])
  })
  .refine(
    (data) =>
      data.dream === 'other'
        ? data.customDream.length >= 5
        : CATEGORIES.find(
            (category) => category.id === data.category
          )?.dreams.some((dream) => dream === data.dream),
    {
      message: 'Escolha um sonho ou conte o seu em pelo menos 5 caracteres.',
      path: ['dream']
    }
  )

export type OnboardingAnswers = z.infer<typeof answersSchema>

export function isStepComplete(answers: DraftAnswers, step: number) {
  const value = answers[answerFields[step]]
  if (step === 0) return CATEGORIES.some((category) => category.id === value)
  if (step === 1)
    return value === 'other'
      ? (answers.customDream?.trim().length ?? 0) >= 5 &&
          (answers.customDream?.length ?? 0) <= 300
      : (CATEGORIES.find(
          (category) => category.id === answers.category
        )?.dreams.some((dream) => dream === value) ?? false)
  const choices = [STAGES, OBSTACLES, TIME_OPTIONS, HORIZONS][step - 2]
  return choices?.some((choice) => choice.id === value) ?? false
}

export function getDream(answers: DraftAnswers) {
  return answers.dream === 'other'
    ? answers.customDream?.trim() || ''
    : answers.dream || ''
}

export function getAnswerContext(answers: OnboardingAnswers) {
  return {
    dream: getDream(answers),
    category: CATEGORIES.find((item) => item.id === answers.category)!.title,
    stage: STAGES.find((item) => item.id === answers.stage)!.title,
    obstacle: OBSTACLES.find((item) => item.id === answers.obstacle)!.title,
    time: TIME_OPTIONS.find((item) => item.id === answers.time)!.title,
    horizon: HORIZONS.find((item) => item.id === answers.horizon)!.title
  }
}

export const previewSchema = z.object({
  title: z.string().trim().min(3).max(70),
  introduction: z.string().trim().min(20).max(420),
  pillars: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(45),
        description: z.string().trim().min(10).max(160)
      })
    )
    .length(8),
  firstStep: z.object({
    title: z.string().trim().min(3).max(80),
    description: z.string().trim().min(10).max(280),
    minutes: z.number().int().min(5).max(30),
    checklist: z.array(z.string().trim().min(5).max(150)).length(3)
  })
})
export type OnboardingPreview = z.infer<typeof previewSchema>

export const ATTRIBUTION_KEYS = [
  'afid',
  'ref',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'src',
  'sck'
] as const
export const attributionSchema = z.object(
  Object.fromEntries(
    ATTRIBUTION_KEYS.map((key) => [key, z.string().max(150).optional()])
  )
)
export const previewRequestSchema = z.object({
  answers: answersSchema,
  attribution: attributionSchema.default({})
})

export type PreviewResponse =
  | { status: 'ready'; id: string; preview: OnboardingPreview }
  | { status: 'blocked'; category: 'illegal' | 'self-harm' }
  | { status: 'error'; message: string; retryAfter?: number }

export const DRAFT_STORAGE_KEY = 'mandalart.begin.v1'
export const DRAFT_LIFETIME = 7 * 24 * 60 * 60 * 1000
export const draftSchema = z.object({
  version: z.literal(1),
  savedAt: z.number(),
  screen: z.enum(['welcome', 'questions', 'generating', 'preview', 'blocked']),
  question: z.number().int().min(0).max(5),
  answers: z.object(
    Object.fromEntries(
      [...answerFields, 'customDream'].map((key) => [
        key,
        z.string().max(300).optional()
      ])
    )
  ),
  result: z
    .object({
      id: z.string().uuid(),
      preview: previewSchema,
      answersKey: z.string()
    })
    .nullable(),
  checked: z.array(z.boolean()).length(3),
  attribution: attributionSchema,
  pack: z.union([z.literal(1), z.literal(3)])
})
export type OnboardingDraft = z.infer<typeof draftSchema>

export function answersKey(answers: DraftAnswers) {
  const result = answersSchema.safeParse(answers)
  return result.success
    ? JSON.stringify({
        ...result.data,
        customDream:
          result.data.dream === 'other' ? result.data.customDream : ''
      })
    : ''
}

export function restoreDraft(
  value: unknown,
  now = Date.now()
): OnboardingDraft | null {
  const parsed = draftSchema.safeParse(value)
  if (
    !parsed.success ||
    now - parsed.data.savedAt > DRAFT_LIFETIME ||
    parsed.data.savedAt > now
  )
    return null
  const draft = parsed.data
  const firstMissing = answerFields.findIndex(
    (_, step) => !isStepComplete(draft.answers, step)
  )
  if (
    !answersSchema.safeParse(draft.answers).success ||
    draft.result?.answersKey !== answersKey(draft.answers)
  ) {
    draft.result = null
    draft.checked = [false, false, false]
  }
  if (
    draft.screen === 'generating' ||
    draft.screen === 'blocked' ||
    (draft.screen === 'preview' && !draft.result)
  ) {
    draft.screen = 'questions'
    draft.question = firstMissing < 0 ? 5 : firstMissing
  }
  if (firstMissing >= 0 && draft.question > firstMissing)
    draft.question = firstMissing
  return draft
}
