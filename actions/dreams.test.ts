import { beforeEach, expect, it, vi } from 'vitest'
import { generateDream } from './dreams'
vi.mock('server-only', () => ({}))
vi.mock('next/server', () => ({ after: vi.fn() }))
vi.mock('@/lib/product-analytics-server', () => ({ captureGeneratedPlan: vi.fn() }))
vi.mock('@/lib/paid-preview', () => ({ loadPaidPreview: vi.fn() }))
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  reserve: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  build: vi.fn(),
  sql: vi.fn(),
}))
vi.mock('@/actions/auth', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/lib/credits', () => ({
  reserveDream: mocks.reserve,
  completeDream: mocks.complete,
  failDream: mocks.fail,
  creditBalance: vi.fn(),
}))
vi.mock('@/lib/stripe', () => ({
  billingMode: () => 'test',
  billingConfig: () => ({ mode: 'test' }),
}))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.sql }))
vi.mock('@/lib/plan-generation', () => ({ buildMandalartData: mocks.build }))
const id = 'b857878a-22e1-4190-a04f-611d6e03d2a0'
const answers = Array.from({ length: 3 }, (_, i) => ({
  questionId: String(i),
  questionText: 'Pergunta?',
  answer: 'Resposta válida',
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.user.mockResolvedValue({ id: 'user' })
})
it('requires authentication before touching credits or AI', async () => {
  mocks.user.mockResolvedValue(null)
  await expect(generateDream(id, 'Aprender inglês', answers)).rejects.toThrow(
    'Faça login',
  )
  expect(mocks.reserve).not.toHaveBeenCalled()
  expect(mocks.build).not.toHaveBeenCalled()
})
it('never calls paid AI without a credit', async () => {
  mocks.reserve.mockResolvedValue({ status: 'insufficient' })
  expect((await generateDream(id, 'Aprender inglês', answers)).status).toBe(
    'insufficient',
  )
  expect(mocks.build).not.toHaveBeenCalled()
})
it('replays an already saved planner without spending or generating again', async () => {
  mocks.reserve.mockResolvedValue({
    status: 'completed',
    result: { id: 'saved' },
  })
  expect(await generateDream(id, 'Aprender inglês', answers)).toEqual({
    status: 'completed',
    item: { id: 'saved' },
  })
  expect(mocks.build).not.toHaveBeenCalled()
})
it('refunds a reserved credit when AI fails', async () => {
  mocks.reserve.mockResolvedValue({ status: 'reserved' })
  mocks.build.mockRejectedValue(new Error('timeout'))
  mocks.sql.mockResolvedValue([{ status: 'failed' }])
  expect((await generateDream(id, 'Aprender inglês', answers)).status).toBe(
    'failed',
  )
  expect(mocks.fail).toHaveBeenCalledWith('user', id)
})
it('rejects an unpaid or foreign sales order before reserving credit or generating', async () => {
  mocks.sql.mockResolvedValue([])
  await expect(generateDream(id, 'Sair das dívidas', answers, undefined, undefined, id)).rejects.toThrow('Compra indisponível')
  expect(mocks.reserve).not.toHaveBeenCalled()
  expect(mocks.build).not.toHaveBeenCalled()
  expect(mocks.sql.mock.calls[0][0].join('?')).toContain("o.status='paid'")
})
it('refuses to reuse a paid sales context for a different goal', async () => {
  mocks.sql.mockResolvedValue([{ answers: { journeyVersion: 'sales-v3', category: 'money', dream: 'Sair das dívidas', obstacle: 'time', horizon: 'month' } }])
  await expect(generateDream(id, 'Aprender inglês', answers, undefined, undefined, id)).rejects.toThrow('Compra indisponível')
  expect(mocks.reserve).not.toHaveBeenCalled()
})
it('passes the purchased four answers to the paid plan generator', async () => {
  const sales = { journeyVersion: 'sales-v3', category: 'money', dream: 'Sair das dívidas', obstacle: 'time', horizon: 'month', customDream: '' }
  mocks.sql.mockResolvedValue([{ answers: sales, status: 'failed' }])
  mocks.reserve.mockResolvedValue({ status: 'reserved' })
  mocks.build.mockRejectedValue(new Error('test stop'))
  await generateDream(id, 'Sair das dívidas', answers, undefined, undefined, id)
  expect(mocks.build).toHaveBeenCalledWith('Sair das dívidas', answers, undefined, undefined, sales)
})
