import { createHmac } from 'node:crypto'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { sendSignInEmail } from '@/lib/transactional-email'

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
  if (request.headers.get('origin') !== new URL(request.url).origin) return new Response(null, { status: 403 })
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
      try { await sendSignInEmail(String(user.id), email) }
      catch { console.error('signin_email_failed', { userId: String(user.id) }) }
    }
  }
  return Response.json({ ok: true, message: 'Se houver uma conta com esse e-mail, enviaremos um link de acesso.' }, { headers: { 'Cache-Control': 'private, no-store' } })
}
