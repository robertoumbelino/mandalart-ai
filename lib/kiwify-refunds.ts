import 'server-only'

import { idSchema } from '@/lib/validation'

const API = 'https://public-api.kiwify.com/v1'
let cachedToken: { value: string; expiresAt: number } | null = null

export class KiwifyRefundRejectedError extends Error {}

export function kiwifyRefundConfigured() {
  return Boolean(process.env.KIWIFY_API_CLIENT_ID && process.env.KIWIFY_API_CLIENT_SECRET && process.env.KIWIFY_API_ACCOUNT_ID)
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value
  const clientId = process.env.KIWIFY_API_CLIENT_ID
  const clientSecret = process.env.KIWIFY_API_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('O reembolso pela Kiwify ainda não está configurado. Fale com o suporte.')

  const response = await fetch(`${API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error('Não foi possível autenticar o estorno na Kiwify. Fale com o suporte.')
  const result = await response.json() as { access_token?: unknown; expires_in?: unknown; scope?: unknown }
  if (typeof result.access_token !== 'string' || !String(result.scope || '').split(' ').includes('sales_refund'))
    throw new Error('A chave da Kiwify não tem permissão para reembolsar. Fale com o suporte.')
  const seconds = Number(result.expires_in)
  cachedToken = { value: result.access_token, expiresAt: Date.now() + (Number.isFinite(seconds) ? seconds : 3600) * 1000 }
  return cachedToken.value
}

async function salesRequest(path: string, method: 'GET' | 'POST') {
  const accountId = process.env.KIWIFY_API_ACCOUNT_ID
  if (!accountId) throw new Error('O reembolso pela Kiwify ainda não está configurado. Fale com o suporte.')
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'x-kiwify-account-id': accountId,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method === 'POST' ? { body: '{}' } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    const message = 'A Kiwify não aceitou a solicitação de estorno. Fale com o suporte.'
    if (method === 'POST' && response.status >= 400 && response.status < 500)
      throw new KiwifyRefundRejectedError(message)
    throw new Error(message)
  }
  return response.json() as Promise<unknown>
}

export async function verifyKiwifySaleForRefund(externalOrderId: string, localOrderId: string, amount: number) {
  if (!idSchema.safeParse(externalOrderId).success || !idSchema.safeParse(localOrderId).success)
    throw new Error('Venda da Kiwify inválida. Fale com o suporte.')
  const sale = await salesRequest(`/sales/${encodeURIComponent(externalOrderId)}`, 'GET') as {
    id?: unknown; status?: unknown; product?: { id?: unknown }; tracking?: { sck?: unknown };
    payment?: { charge_amount?: unknown }
  }
  if (sale.id !== externalOrderId || sale.status !== 'paid' ||
    sale.product?.id !== process.env.KIWIFY_PRODUCT_ID || sale.tracking?.sck !== localOrderId ||
    Number(sale.payment?.charge_amount) !== amount)
    throw new Error('A venda da Kiwify não corresponde a esta compra. Fale com o suporte.')
}

export async function refundKiwifySale(externalOrderId: string) {
  if (!idSchema.safeParse(externalOrderId).success)
    throw new Error('Venda da Kiwify inválida. Fale com o suporte.')
  const result = await salesRequest(`/sales/${encodeURIComponent(externalOrderId)}/refund`, 'POST') as { refunded?: unknown }
  if (result.refunded !== true) throw new Error('A Kiwify ainda não confirmou o estorno. Fale com o suporte.')
}
