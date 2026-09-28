import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { ACCESS_COOKIE, ACCESS_COOKIE_OPTIONS, createEmailAccessSession } from '@/lib/email-access'

export const runtime = 'nodejs'

function valid(token: string | null) { return !!token && /^[\w-]{32,100}$/.test(token) }

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  if (!valid(token)) return new Response('Link inválido.', { status: 400 })
  const html = `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Acessar Mandalart</title></head><body style="font-family:system-ui;background:#f8f7ff;color:#24304a;display:grid;place-items:center;min-height:100vh;margin:0"><main style="background:white;padding:32px;border-radius:20px;max-width:420px;margin:16px;box-shadow:0 12px 40px #1c164220"><h1>Seu Mandalart está pronto para você</h1><p>Confirme para abrir sua conta neste aparelho.</p><form method="post"><input type="hidden" name="token" value="${token}"><button style="padding:16px 24px;background:#6334ff;border:0;border-radius:12px;color:white;font-weight:700;font-size:16px;cursor:pointer">Acessar meu Mandalart</button></form></main></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'" } })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (origin !== new URL(request.url).origin) return new Response('Origem inválida.', { status: 403 })
  const form = await request.formData()
  const token = form.get('token')
  if (typeof token !== 'string' || !valid(token)) return new Response('Link inválido.', { status: 400 })
  const sessionToken = randomBytes(32).toString('base64url')
  const claimed = await createEmailAccessSession(token, sessionToken)
  if (!claimed) return new Response('Este link expirou ou já foi usado. Solicite um novo acesso.', { status: 410 })
  const response = NextResponse.redirect(new URL('/?continuar=sonho', request.url), 303)
  response.cookies.set(ACCESS_COOKIE, sessionToken, ACCESS_COOKIE_OPTIONS)
  return response
}
