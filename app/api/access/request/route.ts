import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { sendRegistrationEmail } from '@/lib/transactional-email'
import { registrationPending } from '@/lib/account-registration'
import { auth } from '@/lib/auth/server'
import { emailOrigin } from '@/lib/stripe'
import { isSameOrigin } from '@/lib/request-origin'

export const runtime = 'nodejs'

const schema = z.object({ email: z.email().max(254) })

function hash(value: string) {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET não configurado.')
  return createHmac('sha256', secret).update(value).digest('hex')
}

async function consumeLimit(key: string, max: number) {
  const [row] = await getDb()`INSERT INTO onboarding_rate_limits(key,count,resets_at)
    VALUES(${key},1,now()+interval '1 hour')
    ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN onboarding_rate_limits.resets_at<=now() THEN 1 ELSE onboarding_rate_limits.count+1 END,
      resets_at=CASE WHEN onboarding_rate_limits.resets_at<=now() THEN now()+interval '1 hour' ELSE onboarding_rate_limits.resets_at END
    RETURNING count`
  return Number(row.count) <= max
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 })
  if (Number(request.headers.get('content-length') || 0) > 2000) return new Response(null, { status: 413 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 })
  const email = parsed.data.email.trim().toLowerCase()
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const [emailAllowed, ipAllowed] = await Promise.all([
    consumeLimit(`access:email:${hash(email)}`, 3),
    consumeLimit(`access:ip:${hash(ip)}`, 12),
  ])
  if (emailAllowed && ipAllowed) {
    const [user] = await getDb()`SELECT id FROM users WHERE lower(email)=${email} LIMIT 1`
    if (user) {
      try {
        if (await registrationPending(String(user.id))) await sendRegistrationEmail(String(user.id), email)
        else {
          const result = await auth.requestPasswordReset({ email, redirectTo: `${emailOrigin()}/redefinir-senha` })
          if (result.error) throw new Error('Password recovery failed')
        }
      }
      catch { console.error('signin_email_failed', { userId: String(user.id) }) }
    }
  }
  return Response.json({ ok: true, message: 'Se houver uma conta com esse e-mail, enviaremos as instruções para concluir o cadastro ou redefinir a senha.' }, { headers: { 'Cache-Control': 'private, no-store' } })
}
