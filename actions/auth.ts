'use server'

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { getDb } from '@/lib/db'
import { credentialsSchema } from '@/lib/validation'
import type { User } from '@/types'

const TOKEN_COOKIE = 'mandalart_token'
const TOKEN_ISSUER = 'mandalart-ai'
const TOKEN_AUDIENCE = 'mandalart-web'
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7

type UserRow = {
  id: string
  email: string
  name: string
  avatar: string | null
  password_hash?: string | null
}

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.')
  }
  return secret
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  avatar: row.avatar || undefined
})

const createSession = async (userId: string) => {
  const token = jwt.sign({ userId }, getJwtSecret(), {
    expiresIn: TOKEN_MAX_AGE,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE
  })
  const cookieStore = await cookies()
  cookieStore.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_MAX_AGE
  })
}

export const login = async (rawEmail: string, rawPassword: string): Promise<User> => {
  const { email, password } = credentialsSchema.parse({
    email: rawEmail,
    password: rawPassword
  })
  const sql = getDb()
  const users = await sql`
    SELECT id, email, name, avatar, password_hash
    FROM users
    WHERE email = ${email}
    LIMIT 1
  ` as UserRow[]
  const user = users[0]

  if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    throw new Error('E-mail ou senha inválidos.')
  }

  await createSession(user.id)
  return toUser(user)
}

export const register = async (rawEmail: string, rawPassword: string): Promise<User> => {
  const { email, password } = credentialsSchema.parse({
    email: rawEmail,
    password: rawPassword
  })
  const sql = getDb()
  const existing = await sql`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  ` as Array<{ id: string }>

  if (existing.length > 0) {
    throw new Error('Já existe uma conta com este e-mail.')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const name = email.split('@')[0].slice(0, 80)
  const rows = await sql`
    INSERT INTO users (email, name, password_hash)
    VALUES (${email}, ${name}, ${passwordHash})
    RETURNING id, email, name, avatar
  ` as UserRow[]
  const user = rows[0]

  await createSession(user.id)
  return toUser(user)
}

export const getCurrentUser = async (): Promise<User | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(TOKEN_COOKIE)?.value
  if (!token) return null

  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE
    }) as jwt.JwtPayload
    if (typeof decoded.userId !== 'string') return null

    const sql = getDb()
    const users = await sql`
      SELECT id, email, name, avatar
      FROM users
      WHERE id = ${decoded.userId}
      LIMIT 1
    ` as UserRow[]

    return users[0] ? toUser(users[0]) : null
  } catch {
    return null
  }
}

export const logout = async (): Promise<void> => {
  const cookieStore = await cookies()
  cookieStore.delete(TOKEN_COOKIE)
}
