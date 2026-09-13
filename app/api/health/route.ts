import { getDb } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sql = getDb()
    await sql`SELECT 1`
    return Response.json({ status: 'ok' })
  } catch {
    return Response.json({ status: 'unhealthy' }, { status: 503 })
  }
}
