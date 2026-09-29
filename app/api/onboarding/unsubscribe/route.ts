import { getDb } from '@/lib/db'
import { verifyUnsubscribeLink } from '@/lib/lead-link'
import { cancelRecoveryEmails } from '@/lib/transactional-email'

export const runtime = 'nodejs'

function page(token: string, done = false) {
  return `<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Preferências de e-mail | Mandalart</title></head><body style="font-family:system-ui;background:#f8f7ff;color:#24304a;display:grid;place-items:center;min-height:100vh;margin:0"><main style="background:white;padding:32px;border-radius:20px;max-width:420px;margin:16px;box-shadow:0 12px 40px #1c164220"><h1>${done ? 'Lembretes cancelados' : 'Cancelar lembretes?'}</h1><p>${done ? 'Você não receberá mais lembretes sobre esta prévia.' : 'Sua prévia continua disponível. Você pode cancelar as mensagens de lembrete agora.'}</p>${done ? '' : `<form method="post"><input type="hidden" name="token" value="${token}"><button style="padding:14px 20px;background:#6334ff;border:0;border-radius:12px;color:white;font-weight:700;cursor:pointer">Cancelar lembretes</button></form>`}</main></body></html>`
}

const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'" }

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || ''
  try { verifyUnsubscribeLink(token) } catch { return new Response('Link inválido.', { status: 400 }) }
  return new Response(page(token), { headers })
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return new Response('Origem inválida.', { status: 403 })
  const token = (await request.formData()).get('token')
  if (typeof token !== 'string') return new Response('Link inválido.', { status: 400 })
  let leadId: string
  try { leadId = verifyUnsubscribeLink(token) } catch { return new Response('Link inválido.', { status: 400 }) }
  await getDb()`UPDATE onboarding_leads SET recovery_unsubscribed_at=COALESCE(recovery_unsubscribed_at,now()) WHERE id=${leadId}::uuid`
  await cancelRecoveryEmails(leadId)
  return new Response(page('', true), { headers })
}
