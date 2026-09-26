import { describe, expect, it } from 'vitest'
import {
  credentialsSchema,
  generatedMandalartSchema,
  goalDiscoveryOutputSchema,
  goalProposalSchema,
  goalSafetyOutputSchema,
  mandalartDataSchema,
} from './validation'

const generatedTask = {
  title: 'Tarefa',
  description: 'Descrição prática',
  advice: 'Comece pequeno',
  checklist: ['Preparar', 'Executar', 'Revisar']
}

const generatedSubGoal = {
  title: 'Subobjetivo',
  description: 'Descrição',
  advice: 'Conselho',
  tasks: Array.from({ length: 8 }, () => generatedTask)
}

describe('AI output schemas', () => {
  it('accepts one question or a confirmed goal proposal', () => {
    expect(goalDiscoveryOutputSchema.safeParse({
      status: 'question',
      question: { text: 'Qual resultado você busca?', options: ['Uma opção', 'Outra opção'] },
      proposal: null
    }).success).toBe(true)
    expect(goalProposalSchema.safeParse({
      goal: 'Criar uma renda extra mensal',
      successSignal: 'Receber o primeiro pagamento recorrente',
      firstPhase: 'Explorar e testar opções viáveis'
    }).success).toBe(true)
  })

  it('only accepts supported goal safety classifications', () => {
    expect(goalSafetyOutputSchema.safeParse({ classification: 'allowed' }).success).toBe(true)
    expect(goalSafetyOutputSchema.safeParse({ classification: 'illegal' }).success).toBe(true)
    expect(goalSafetyOutputSchema.safeParse({ classification: 'self_harm' }).success).toBe(true)
    expect(goalSafetyOutputSchema.safeParse({ classification: 'uncertain' }).success).toBe(false)
  })

  it('rejects incomplete Mandalart matrices', () => {
    const result = generatedMandalartSchema.safeParse({
      mainGoal: 'Concluir um objetivo',
      subGoals: Array.from({ length: 7 }, () => generatedSubGoal)
    })
    expect(result.success).toBe(false)
  })

  it('rejects a central title that will not fit the grid', () => {
    const result = generatedMandalartSchema.safeParse({
      mainGoal: 'Organizar minha vida financeira durante todo o próximo ano',
      subGoals: Array.from({ length: 8 }, () => generatedSubGoal)
    })
    expect(result.success).toBe(false)
  })

  it('accepts a complete persisted matrix', () => {
    const result = mandalartDataSchema.safeParse({
      mainGoal: 'Concluir um objetivo',
      subGoals: Array.from({ length: 8 }, () => ({
        ...generatedSubGoal,
        tasks: generatedSubGoal.tasks.map(task => ({
          ...task,
          isCompleted: false,
          checklist: task.checklist.map((text, index) => ({
            id: `item-${index}`,
            text,
            checked: false
          }))
        }))
      }))
    })
    expect(result.success).toBe(true)
  })
})

describe('credentials schema', () => {
  it('normalizes email and enforces a useful password length', () => {
    expect(credentialsSchema.parse({ email: ' User@Example.com ', password: '12345678' }).email)
      .toBe('user@example.com')
    expect(credentialsSchema.safeParse({ email: 'user@example.com', password: 'short' }).success)
      .toBe(false)
  })

})
