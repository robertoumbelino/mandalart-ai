import 'server-only'
import { createHash } from 'node:crypto'
import { getDb } from '@/lib/db'

export function validRegistrationToken(token: string) {
  return /^[\w-]{32,100}$/.test(token)
}

export async function registrationPending(userId: string) {
  const [row] = await getDb()`SELECT (u.password_hash IS NULL
    AND NOT EXISTS (SELECT 1 FROM auth_user_links l WHERE l.user_id=u.id)
    AND NOT EXISTS (SELECT 1 FROM user_identities i WHERE i.user_id=u.id)) AS pending
    FROM users u WHERE u.id=${userId}::uuid`
  return Boolean(row?.pending)
}

export async function registrationFromToken(token: string) {
  if (!validRegistrationToken(token)) return null
  const hash = createHash('sha256').update(token).digest('hex')
  const [row] = await getDb()`SELECT u.id,u.email,u.name,
    (u.password_hash IS NULL
      AND NOT EXISTS (SELECT 1 FROM auth_user_links l WHERE l.user_id=u.id)
      AND NOT EXISTS (SELECT 1 FROM user_identities i WHERE i.user_id=u.id)) AS pending
    FROM email_access_tokens t JOIN users u ON u.id=t.user_id
    WHERE t.token_hash=${hash} AND t.consumed_at IS NULL AND t.expires_at>now()`
  if (!row) return null
  return { id: String(row.id), email: String(row.email), name: String(row.name), pending: Boolean(row.pending) }
}

export async function consumeRegistrationToken(token: string, userId: string) {
  if (!validRegistrationToken(token)) return
  const hash = createHash('sha256').update(token).digest('hex')
  await getDb()`UPDATE email_access_tokens SET consumed_at=now()
    WHERE token_hash=${hash} AND user_id=${userId}::uuid AND consumed_at IS NULL`
}

// Claim the one-time email proof and link the managed identity in one transaction.
// Never replace a password or identity on an account that is already registered.
export async function linkRegistration(token: string, authUserId: string, userId: string, name: string) {
  const hash = createHash('sha256').update(token).digest('hex')
  const [row] = await getDb()`WITH claimed AS (
    UPDATE email_access_tokens t SET consumed_at=now()
    WHERE t.token_hash=${hash} AND t.user_id=${userId}::uuid
      AND t.consumed_at IS NULL AND t.expires_at>now()
      AND EXISTS (SELECT 1 FROM users u WHERE u.id=t.user_id AND u.password_hash IS NULL)
      AND NOT EXISTS (SELECT 1 FROM auth_user_links l WHERE l.user_id=t.user_id)
      AND NOT EXISTS (SELECT 1 FROM user_identities i WHERE i.user_id=t.user_id)
    RETURNING t.user_id
  ), linked AS (
    INSERT INTO auth_user_links(auth_user_id,user_id)
    SELECT ${authUserId}::uuid,user_id FROM claimed RETURNING user_id
  ) UPDATE users SET name=${name} WHERE id IN (SELECT user_id FROM linked) RETURNING id`
  return Boolean(row)
}
