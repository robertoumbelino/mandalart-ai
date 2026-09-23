import 'server-only'
import { neon } from '@neondatabase/serverless'
import { Pool, type PoolClient } from 'pg'

type Rows = Record<string, unknown>[]
type Query = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Rows>
type Database = Query & {
  transaction: (queries: (query: Query) => Promise<Rows>[]) => Promise<Rows[]>
}

let sql: Database | null = null

const postgresQuery =
  (client: Pool | PoolClient): Query =>
  async (strings, ...values) => {
    const text = strings.reduce(
      (query, part, index) => query + (index ? `$${index}` : '') + part,
      ''
    )
    return (await client.query(text, values)).rows
  }

export const getDb = () => {
  if (!sql) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL não está configurada.')
    }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(
      new URL(databaseUrl).hostname
    )
    if (
      !local &&
      (process.env.NODE_ENV === 'development' ||
        process.env.LOCAL_DATABASE_ONLY === 'true')
    ) {
      throw new Error(
        'Desenvolvimento bloqueado: configure DATABASE_URL para um Postgres local.'
      )
    }
    if (local) {
      const pool = new Pool({
        connectionString: databaseUrl,
        max: 5,
        idleTimeoutMillis: 10_000
      })
      pool.on('error', () =>
        console.error('local_database_idle_connection_lost')
      )
      sql = Object.assign(postgresQuery(pool), {
        transaction: async (queries: (query: Query) => Promise<Rows>[]) => {
          const client = await pool.connect()
          try {
            await client.query('BEGIN')
            const results = await Promise.all(queries(postgresQuery(client)))
            await client.query('COMMIT')
            return results
          } catch (error) {
            await client.query('ROLLBACK')
            throw error
          } finally {
            client.release()
          }
        }
      })
    } else {
      sql = neon(databaseUrl) as unknown as Database
    }
  }
  return sql
}
