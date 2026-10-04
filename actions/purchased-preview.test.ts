import { beforeEach, expect, it, vi } from 'vitest'
import { getPurchasedPreviewContext } from './purchased-preview'
const mocks = vi.hoisted(() => ({ user: vi.fn(), sql: vi.fn() }))
vi.mock('@/actions/auth', () => ({ getCurrentUser: mocks.user }))
vi.mock('@/lib/db', () => ({ getDb: () => mocks.sql }))
vi.mock('@/lib/stripe', () => ({ billingMode: () => 'test' }))
const answers = { journeyVersion: 'sales-v3', category: 'money', dream: 'Sair das dívidas', obstacle: 'time', horizon: 'month' }
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: 'user' }) })
it('restores a paid four-question intent without requiring a preview', async () => {
  mocks.sql.mockResolvedValue([{ id: 'intent', order_id: 'order', answers, preview: null }])
  expect(await getPurchasedPreviewContext()).toMatchObject({ journeyVersion: 'sales-v3', orderId: 'order', answers, preview: null })
  const query = mocks.sql.mock.calls[0][0].join('?')
  expect(query).toContain('o.paid=true')
  expect(query).toContain('o.user_id=')
})
it('does not expose another visitor intent without authentication', async () => {
  mocks.user.mockResolvedValue(null)
  expect(await getPurchasedPreviewContext()).toBeNull()
  expect(mocks.sql).not.toHaveBeenCalled()
})
