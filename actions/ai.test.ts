import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateText } from 'ai'
import { discoverGoal } from './ai'
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
  ] as const)('blocks %s goals before asking a question', async (classification, category) => {
    generateTextMock.mockResolvedValueOnce({ output: { classification } } as never)

    await expect(discoverGoal('Objetivo de teste válido', [])).resolves.toEqual({
      status: 'blocked',
      category
    })
    expect(generateTextMock).toHaveBeenCalledTimes(1)
  })

  it('continues discovering a broad goal after the first answer', async () => {
    const question = { text: 'Qual resultado você busca?', options: ['Renda mensal', 'Um valor pontual'] }
    const followUp = { text: 'Qual valor mensal faria diferença?', options: ['Até R$ 500', 'Mais de R$ 1.000'] }
    const proposal = {
      goal: 'Criar uma renda extra mensal',
      successSignal: 'Receber um pagamento extra todo mês',
      firstPhase: 'Testar uma atividade viável'
    }
    generateTextMock
      .mockResolvedValueOnce({ output: { classification: 'allowed' } } as never)
      .mockResolvedValueOnce({ output: question } as never)
      .mockResolvedValueOnce({ output: { classification: 'allowed' } } as never)
      .mockResolvedValueOnce({ output: followUp } as never)
      .mockResolvedValueOnce({ output: { classification: 'allowed' } } as never)
      .mockResolvedValueOnce({ output: { status: 'ready', question: null, proposal } } as never)

    await expect(discoverGoal('Quero uma renda extra', [])).resolves.toEqual({
      status: 'question',
      question: { id: 'q1', ...question }
    })
    const firstAnswer = {
      questionId: 'q1', questionText: question.text, answer: 'Renda mensal'
    }
    await expect(discoverGoal('Quero uma renda extra', [firstAnswer])).resolves.toEqual({
      status: 'question', question: { id: 'q2', ...followUp }
    })
    await expect(discoverGoal('Quero uma renda extra', [firstAnswer, {
      questionId: 'q2', questionText: followUp.text, answer: 'Mais de R$ 1.000'
    }])).resolves.toEqual({ status: 'ready', proposal })
    expect(generateTextMock).toHaveBeenCalledTimes(6)
    expect(generateTextMock.mock.calls[1][0].model).toBe('openai/gpt-6-luna-fast')
  })

  it('does not confirm a vague SaaS goal after only one question', async () => {
    const questions = [
      { text: 'Qual problema e público você quer atender?', options: ['Já tenho ambos', 'Ainda vou descobrir'] },
      { text: 'Em que estágio está seu SaaS?', options: ['Só uma ideia', 'Produto em operação'] },
      { text: 'O que significaria sucesso para você?', options: ['Primeiros clientes', 'Receita recorrente'] },
    ]
    for (let index = 0; index < questions.length; index++) {
      generateTextMock
        .mockResolvedValueOnce({ output: { classification: 'allowed' } } as never)
        .mockResolvedValueOnce({ output: questions[index] } as never)
      const answers = questions.slice(0, index).map((question, answerIndex) => ({
        questionId: `q${answerIndex + 1}`, questionText: question.text, answer: question.options[0]
      }))
      await expect(discoverGoal('Ter um SaaS de sucesso', answers)).resolves.toEqual({
        status: 'question', question: { id: `q${index + 1}`, ...questions[index] }
      })
    }
    expect(generateTextMock).toHaveBeenCalledTimes(6)
  })

  it('screens new answers before asking the next question', async () => {
    generateTextMock.mockResolvedValueOnce({ output: { classification: 'illegal' } } as never)
    await expect(discoverGoal('Quero uma renda extra', [{
      questionId: 'q1', questionText: 'Como pretende começar?', answer: 'Resposta proibida'
    }])).resolves.toEqual({ status: 'blocked', category: 'illegal' })
    expect(generateTextMock).toHaveBeenCalledTimes(1)
    expect(generateTextMock.mock.calls[0][0].prompt).toContain('Resposta proibida')
  })
  it('uses the four-question purchase as context and still asks a specific interview question', async () => {
    generateTextMock.mockResolvedValueOnce({ output: { classification: 'allowed' } } as never)
      .mockResolvedValueOnce({ output: { text: 'Qual valor total você precisa organizar?', options: ['Já tenho esse valor', 'Preciso levantar'] } } as never)
    const sales = { journeyVersion: 'sales-v3' as const, category: 'money' as const, dream: 'Sair das dívidas', obstacle: 'time' as const, horizon: 'month' as const, customDream: '' }
    expect((await discoverGoal(sales.dream, [], sales)).status).toBe('question')
    const prompt = generateTextMock.mock.calls[1][0].prompt as string
    expect(prompt).toContain('quizContext')
    expect(prompt).toContain('sales-obstacle')
    expect(prompt).not.toContain('sales-stage')
  })

  it('finishes with a proposal after six answers instead of looping', async () => {
    const proposal = {
      goal: 'Descobrir uma opção viável de renda extra',
      successSignal: 'Testar uma atividade e avaliar o resultado',
      firstPhase: 'Comparar opções com a rotina disponível'
    }
    generateTextMock.mockResolvedValueOnce({ output: { classification: 'allowed' } } as never)
      .mockResolvedValueOnce({ output: proposal } as never)
    await expect(discoverGoal('Quero uma renda extra', Array.from({ length: 6 }, (_, index) => ({
      questionId: `q${index + 1}`, questionText: `Pergunta ${index + 1}?`, answer: 'Ainda não sei'
    })))).resolves.toEqual({ status: 'ready', proposal })
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

it.each([[false, false, false], [true, false, true], [true, true, true]])('preserves purchased preview content and progress %j', async (...checked) => {
  const preview = {
    checked, title: 'Começar um novo idioma', introduction: 'Um caminho possível para estudar no seu ritmo.',
    pillars: Array.from({ length: 8 }, (_, i) => ({ title: `Pilar da prévia ${i + 1}`, description: 'Descrição original do pilar.' })),
    firstStep: { title: 'Meu primeiro passo original', description: 'A descrição do primeiro passo que foi apresentada na prévia.', minutes: 15, checklist: ['A'.repeat(150), 'Ação original dois', 'Ação original três'] }
  }
  const generated = { mainGoal: 'Aprender um idioma', subGoals: Array.from({ length: 8 }, () => ({ title: 'Título reescrito', description: 'Descrição reescrita', advice: 'Uma orientação concreta.', tasks: Array.from({ length: 8 }, () => ({ title: 'Uma tarefa prática', description: 'Faça a tarefa com atenção.', advice: 'Reserve tempo para praticar.', checklist: ['Primeira ação', 'Segunda ação', 'Terceira ação'] })) })) }
  const proposal = { goal: 'Aprender um idioma', successSignal: 'Conseguir manter uma conversa simples', firstPhase: 'Escolher um idioma e organizar a prática' }
  generateTextMock.mockReset()
  generateTextMock.mockResolvedValueOnce({ output: { classification: 'allowed' } } as never)
    .mockResolvedValueOnce({ output: { mainGoal: generated.mainGoal, subGoals: generated.subGoals.map(({ title, description, advice }) => ({ title, description, advice })) } } as never)
  for (let index = 0; index < 4; index++) {
    generateTextMock.mockResolvedValueOnce({ output: { pillars: generated.subGoals.slice(index * 2, index * 2 + 2).map(({ tasks }) => ({ tasks })) } } as never)
  }
  const result = await buildMandalartData('Aprender um idioma', Array.from({ length: 3 }, (_, i) => ({ questionId: String(i), questionText: 'Pergunta válida?', answer: 'Resposta válida.' })), preview, proposal)
  expect(generateTextMock.mock.calls[1][0].model).toBe('openai/gpt-6-luna')
  expect(generateTextMock.mock.calls[1][0].prompt).toContain(proposal.successSignal)
  expect(generateTextMock).toHaveBeenCalledTimes(6)
  expect(result.subGoals.map(p => p.title)).toEqual(preview.pillars.map(p => p.title))
  expect(result.subGoals[0].tasks[0].title).toBe(preview.firstStep.title)
  expect(result.subGoals[0].tasks[0].checklist.map(c => c.text)).toEqual(preview.firstStep.checklist)
  expect(result.subGoals[0].tasks[0].checklist.map(c => c.checked)).toEqual(checked)
  expect(result.subGoals[0].tasks[0].isCompleted).toBe(checked.every(Boolean))
  expect(result.subGoals[0].tasks[1].checklist.every(c => !c.checked)).toBe(true)
  expect(result.subGoals.flatMap(p => p.tasks)).toHaveLength(64)
  expect(() => mandalartDataSchema.parse(result)).not.toThrow()
})

it('recovers a malformed two-pillar response by generating each pillar separately', async () => {
  const pillar = { title: 'Validar uma ideia', description: 'Descobrir uma necessidade real.', advice: 'Converse com possíveis clientes.' }
  const tasks = Array.from({ length: 8 }, (_, index) => ({
    title: `Tarefa ${index + 1}`, description: 'Realize uma ação observável.',
    advice: 'Registre o resultado.', checklist: ['Preparar a ação', 'Executar a ação', 'Anotar o resultado']
  }))
  generateTextMock.mockReset()
  generateTextMock.mockResolvedValueOnce({ output: { classification: 'allowed' } } as never)
    .mockResolvedValueOnce({ output: { mainGoal: 'Validar um SaaS', subGoals: Array.from({ length: 8 }, () => pillar) } } as never)
    .mockRejectedValueOnce(new Error('Resposta incompleta'))
  for (let index = 0; index < 3; index++) {
    generateTextMock.mockResolvedValueOnce({ output: { pillars: [{ tasks }, { tasks }] } } as never)
  }
  generateTextMock.mockResolvedValueOnce({ output: { tasks } } as never)
    .mockResolvedValueOnce({ output: { tasks } } as never)

  const result = await buildMandalartData('Criar um SaaS', [])
  expect(result.subGoals).toHaveLength(8)
  expect(result.subGoals.flatMap((subGoal) => subGoal.tasks)).toHaveLength(64)
  expect(generateTextMock).toHaveBeenCalledTimes(8)
})
