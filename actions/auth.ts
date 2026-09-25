'use server'

import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth/server'
import { getDb } from '@/lib/db'
import { credentialsSchema } from '@/lib/validation'
import type { User } from '@/types'

type UserRow = { id: string; email: string; name: string; avatar: string | null }
type AuthProfile = {
  id: string
  email: string
  name: string
  image?: string | null
  emailVerified: boolean
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  avatar: row.avatar || undefined
})

const linkedUser = async (authUserId: string): Promise<UserRow | null> => {
  const sql = getDb()
  const rows = await sql`
    SELECT u.id, u.email, u.name, u.avatar
    FROM auth_user_links link
    JOIN users u ON u.id = link.user_id
    WHERE link.auth_user_id = ${authUserId}::uuid
    LIMIT 1
  ` as UserRow[]
  return rows[0] || null
}

const saveLink = async (authUserId: string, userId: string): Promise<UserRow> => {
  const sql = getDb()
  await sql`
    INSERT INTO auth_user_links (auth_user_id, user_id)
    VALUES (${authUserId}::uuid, ${userId}::uuid)
    ON CONFLICT (auth_user_id) DO NOTHING
  `
  const linked = await linkedUser(authUserId)
  if (!linked || linked.id !== userId) {
    throw new Error('Esta identidade já está vinculada a outra conta.')
  }
  return linked
}

const resolveUser = async (profile: AuthProfile): Promise<User | null> => {
  const existingLink = await linkedUser(profile.id)
  if (existingLink) return toUser(existingLink)

  const sql = getDb()
  const { data: accounts, error: accountsError } = await auth.listAccounts()
  if (accountsError) throw new Error('Não foi possível verificar as identidades da conta.')
  const subject = accounts?.find(account => account.providerId === 'google')?.accountId

  if (subject) {
    const legacy = await sql`
      SELECT u.id, u.email, u.name, u.avatar
      FROM user_identities identity
      JOIN users u ON u.id = identity.user_id
      WHERE identity.provider = 'google'
        AND identity.provider_account_id = ${subject}
      LIMIT 1
    ` as UserRow[]
    if (legacy[0]) return toUser(await saveLink(profile.id, legacy[0].id))
  }

  // Um e-mail ainda não verificado nunca pode assumir uma conta antiga.
  const matchedEmail = await sql`
    SELECT id, email, name, avatar FROM users
    WHERE LOWER(email) = ${profile.email.toLowerCase()}
    LIMIT 1
  ` as UserRow[]
  if (matchedEmail[0]) {
    // Um Google subject diferente não pode assumir uma identidade Google existente.
    if (subject && matchedEmail[0].id !== profile.id) return null
    if (!profile.emailVerified) return null
    return toUser(await saveLink(profile.id, matchedEmail[0].id))
  }

  const newUsers = await sql`
    INSERT INTO users (id, email, name, avatar, password_hash)
    VALUES (${profile.id}::uuid, ${profile.email.toLowerCase()}, ${profile.name}, ${profile.image || null}, NULL)
    ON CONFLICT DO NOTHING
    RETURNING id, email, name, avatar
  ` as UserRow[]
  const created = newUsers[0]
  if (!created) return null

  if (subject) {
    await sql`
      INSERT INTO user_identities (user_id, provider, provider_account_id, email)
      VALUES (${created.id}::uuid, 'google', ${subject}, ${profile.email.toLowerCase()})
      ON CONFLICT (provider, provider_account_id) DO NOTHING
    `
  }
  return toUser(await saveLink(profile.id, created.id))
}

export const getCurrentUser = async (): Promise<User | null> => {
  const { data: session, error } = await auth.getSession()
  if (error || !session?.user?.email) return null
  return resolveUser({ ...session.user, email: session.user.email })
}

export const login = async (rawEmail: string, rawPassword: string): Promise<void> => {
  const { email, password } = credentialsSchema.parse({ email: rawEmail, password: rawPassword })
  const signedIn = await auth.signIn.email({ email, password })
  if (!signedIn.error) return

  // Migra a senha antiga quando o titular a comprovar no primeiro acesso.
  const sql = getDb()
  const legacy = await sql`
    SELECT id, email, name, avatar, password_hash
    FROM users WHERE LOWER(email) = ${email} LIMIT 1
  ` as Array<UserRow & { password_hash: string | null }>
  const oldUser = legacy[0]
  if (!oldUser?.password_hash || !(await bcrypt.compare(password, oldUser.password_hash))) {
    throw new Error('E-mail ou senha inválidos.')
  }

  const migrated = await auth.signUp.email({ email, name: oldUser.name, password })
  if (migrated.error || !migrated.data?.user) {
    throw new Error('Entre com Google e redefina sua senha para continuar.')
  }
  await saveLink(migrated.data.user.id, oldUser.id)
}

export const register = async (rawEmail: string, rawPassword: string): Promise<void> => {
  const { email, password } = credentialsSchema.parse({ email: rawEmail, password: rawPassword })
  const sql = getDb()
  const existing = await sql`SELECT id FROM users WHERE LOWER(email) = ${email} LIMIT 1`
  if (existing.length) throw new Error('Já existe uma conta com este e-mail.')

  const created = await auth.signUp.email({
    email,
    name: email.split('@')[0].slice(0, 80),
    password
  })
  if (created.error) throw new Error(created.error.message || 'Não foi possível criar a conta.')
}

export const logout = async (): Promise<void> => {
  const result = await auth.signOut()
  if (result.error) throw new Error('Não foi possível encerrar a sessão.')
}
