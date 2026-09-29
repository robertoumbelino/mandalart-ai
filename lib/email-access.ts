import 'server-only'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { tokenHash } from '@/lib/transactional-email'
import type { User } from '@/types'

export const ACCESS_COOKIE = 'mandalart_email_access'
const MONTH = 30 * 24 * 60 * 60

export async function getEmailAccessUser(): Promise<User | null> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value
  if (!token || !/^[\w-]{32,100}$/.test(token)) return null
  const [row] = await getDb()`SELECT u.id,u.email,u.name,u.avatar
    FROM email_access_sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=${tokenHash(token)} AND s.revoked_at IS NULL AND s.expires_at>now()`
  if (!row) return null
  return { id: String(row.id), email: String(row.email), name: String(row.name), avatar: row.avatar ? String(row.avatar) : undefined }
}

export async function revokeEmailAccess() {
  const jar = await cookies()
  const token = jar.get(ACCESS_COOKIE)?.value
  if (token) await getDb()`UPDATE email_access_sessions SET revoked_at=now() WHERE token_hash=${tokenHash(token)}`
  jar.delete(ACCESS_COOKIE)
}

export async function createEmailAccessSession(token: string, sessionToken: string) {
  const sql = getDb()
  const [created] = await sql`WITH claimed AS (
    UPDATE email_access_tokens SET consumed_at=now()
    WHERE token_hash=${tokenHash(token)} AND consumed_at IS NULL AND expires_at>now()
    RETURNING user_id
  ) INSERT INTO email_access_sessions(user_id,token_hash,expires_at)
    SELECT user_id,${tokenHash(sessionToken)},now()+interval '30 days' FROM claimed
    RETURNING id`
  return Boolean(created)
}

export async function createPaidBrowserSession(userId: string, sessionToken: string) {
  await getDb()`INSERT INTO email_access_sessions(user_id,token_hash,expires_at)
    VALUES(${userId}::uuid,${tokenHash(sessionToken)},now()+interval '30 days')`
}

export const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MONTH,
}
