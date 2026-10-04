import { expect, it } from 'vitest'
import { OBSTACLE_PROMISES, restoreSalesDraft, salesAnswersSchema, salesInterviewContext, salesStepComplete, salesTitle, type SalesDraft } from './sales-journey'
const answers = { journeyVersion: 'sales-v3' as const, category: 'money' as const, dream: 'Sair das dívidas', obstacle: 'time' as const, horizon: 'month' as const }
it('requires only the four answers actually collected', () => {
  expect(salesAnswersSchema.parse(answers)).toEqual({ ...answers, customDream: '' })
  expect(salesAnswersSchema.safeParse({ ...answers, dream: 'Aprender um idioma' }).success).toBe(false)
  expect(salesAnswersSchema.safeParse({ ...answers, dream: 'other', customDream: 'a' }).success).toBe(false)
  expect(salesAnswersSchema.safeParse({ ...answers, dream: 'other', customDream: 'Meu objetivo pessoal' }).success).toBe(true)
})
it.each([['month','Seu plano de 30 dias para sair das dívidas'],['quarter','Seu plano de 3 meses para sair das dívidas'],['semester','Seu plano de 6 meses para sair das dívidas'],['open','Seu plano para sair das dívidas']])('uses the selected horizon %s', (horizon,title) => {
  expect(salesTitle({ ...answers, horizon: horizon as typeof answers.horizon })).toBe(title)
})
it('does not invent stage or time answers for the paid interview', () => {
  expect(salesInterviewContext(salesAnswersSchema.parse(answers)).map(item => item.questionId)).toEqual(['sales-category','sales-obstacle','sales-horizon'])
  expect(OBSTACLE_PROMISES.time).toBe('Tarefas de até 20 minutos')
  expect([0,1,2,3].every(step => salesStepComplete(answers, step))).toBe(true)
})
it('restores the closure without starting generation or losing an incomplete answer', () => {
  const draft: SalesDraft = { version:3, attemptId:'5d4a4ef1-3aab-46b4-b954-c8c058ed03b5',savedAt:100,screen:'processing',question:3,answers,intentId:null }
  expect(restoreSalesDraft(draft,101)?.screen).toBe('closing')
  expect(restoreSalesDraft({ ...draft,answers:{journeyVersion:'sales-v3',category:'money',dream:'other',customDream:'meu'} },101)).toMatchObject({ screen:'questions',question:1,intentId:null })
  expect(restoreSalesDraft(draft,100+8*86400*1000)).toBeNull()
})
