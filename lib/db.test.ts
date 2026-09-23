import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
  neon: vi.fn(),
  on: vi.fn()
}))
vi.mock('server-only', () => ({}))
vi.mock('@neondatabase/serverless', () => ({ neon: mocks.neon }))
vi.mock('pg', () => ({
  Pool: class {
    query = mocks.query
    connect = mocks.connect
    on = mocks.on
  }
}))

describe('database isolation and adapter', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
    mocks.query.mockResolvedValue({ rows: [{ ok: true }] })
    mocks.connect.mockResolvedValue({
      query: mocks.query,
      release: mocks.release
    })
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('LOCAL_DATABASE_ONLY', 'true')
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://test:test@127.0.0.1:55432/mandalart_local'
    )
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })
  it('refuses a remote database during development', async () => {
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://test:test@production.example/database'
    )
    const { getDb } = await import('./db')
    expect(() => getDb()).toThrow('Postgres local')
    expect(mocks.neon).not.toHaveBeenCalled()
  })
  it('preserves isolation during a local production build', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://test:test@production.example/database'
    )
    const { getDb } = await import('./db')
    expect(() => getDb()).toThrow('Postgres local')
  })
  it('keeps SQL values parameterized with the local driver', async () => {
    const { getDb } = await import('./db')
    const dangerous = "name'; DROP TABLE users; --"
    await getDb()`SELECT id FROM users WHERE name = ${dangerous} AND email = ${'test@example.com'}`
    expect(mocks.query).toHaveBeenCalledWith(
      'SELECT id FROM users WHERE name = $1 AND email = $2',
      [dangerous, 'test@example.com']
    )
    expect(mocks.neon).not.toHaveBeenCalled()
  })
  it('commits both operations on the same connection', async () => {
    const { getDb } = await import('./db')
    const result = await getDb().transaction((sql) => [
      sql`SELECT ${1}`,
      sql`SELECT ${2}`
    ])
    expect(result).toHaveLength(2)
    expect(mocks.query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      'SELECT $1',
      'SELECT $1',
      'COMMIT'
    ])
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })
  it('rolls back a failed transaction and releases its connection', async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValue({ rows: [] })
    const { getDb } = await import('./db')
    await expect(
      getDb().transaction((sql) => [sql`SELECT ${1}`])
    ).rejects.toThrow('write failed')
    expect(mocks.query.mock.calls.map((call) => call[0])).toEqual([
      'BEGIN',
      'SELECT $1',
      'ROLLBACK'
    ])
    expect(mocks.release).toHaveBeenCalledTimes(1)
  })
  it('retains the existing Neon driver for a configured deployment', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LOCAL_DATABASE_ONLY', 'false')
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://test:test@production.example/database'
    )
    mocks.neon.mockReturnValue(vi.fn())
    const { getDb } = await import('./db')
    getDb()
    expect(mocks.neon).toHaveBeenCalledTimes(1)
    expect(mocks.connect).not.toHaveBeenCalled()
  })
})
