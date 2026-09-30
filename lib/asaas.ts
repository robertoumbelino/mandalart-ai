import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { billingMode, billingOrigin, paymentProvider } from '@/lib/stripe'

export type AsaasCheckout = {
  id: string
  link?: string | null
  status: 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'PAID'
  externalReference?: string | null
  billingTypes?: string[]
  chargeTypes?: string[]
}

export type AsaasPayment = {
  id: string
  customer: string
  checkoutSession?: string | null
  pixQrCodeId?: string | null
  externalReference?: string | null
  status: string
  billingType: string
  value: number
  refunds?: { status: string; value: number }[]
}

type AsaasPixQr = {
  id: string
  payload: string
  encodedImage: string
  allowsMultiplePayments: boolean
  externalReference?: string | null
}

export function directAsaasPixEnabled() {
  if (paymentProvider() !== 'asaas' || process.env.ASAAS_DIRECT_PIX_ENABLED !== 'true' ||
    !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(process.env.ASAAS_PIX_KEY || '')) return false
  billingMode() // Keep the existing live/test environment isolation before exposing Pix.
  return true
}

export async function createAsaasPixQr(orderId: string, amount: number) {
  if (!directAsaasPixEnabled()) throw new Error('Pix direto indisponível neste ambiente.')
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Valor Pix inválido.')
  const qr = await request<AsaasPixQr>('/pix/qrCodes/static', {
    method: 'POST',
    body: JSON.stringify({
      addressKey: process.env.ASAAS_PIX_KEY,
      description: 'Mandalart - planner digital',
      value: amount / 100,
      format: 'ALL',
      expirationSeconds: 3600,
      allowsMultiplePayments: false,
      externalReference: orderId,
    }),
  })
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(qr.id) ||
    !/^000201/.test(qr.payload) || qr.payload.length > 2048 ||
    !/^[A-Za-z0-9+/=]+$/.test(qr.encodedImage) || qr.encodedImage.length > 100_000 ||
    qr.allowsMultiplePayments !== false || qr.externalReference !== orderId)
    throw new Error('QR Code Pix inválido retornado pelo Asaas.')
  return { id: qr.id, payload: qr.payload, image: qr.encodedImage }
}

export async function getAsaasPixPayments(qrId: string) {
  const response = await request<{ data: AsaasPayment[]; hasMore?: boolean }>(`/payments?pixQrCodeId=${encodeURIComponent(qrId)}&limit=10`)
  if (response.hasMore) throw new Error('QR Code com cobranças demais.')
  const payments = response.data || []
  if (payments.some(payment => payment.pixQrCodeId !== qrId))
    throw new Error('Cobrança Pix não corresponde ao QR Code.')
  return payments
}

function apiBase() {
  if (paymentProvider() !== 'asaas') throw new Error('Asaas não está ativo.')
  return billingMode() === 'test'
    ? 'https://api-sandbox.asaas.com/v3'
    : 'https://api.asaas.com/v3'
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = new URL(`${apiBase()}${path}`)
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      'User-Agent': 'Mandalart/1.0',
      access_token: process.env.ASAAS_API_KEY!,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    console.error('asaas_api_error', { path: url.pathname, status: response.status, errors: body?.errors })
    throw new Error('O Asaas não conseguiu concluir esta operação. Tente novamente em instantes.')
  }
  return body as T
}

export function asaasCheckoutUrl(id: string, rawLink?: string | null) {
  const expectedHost = billingMode() === 'test' ? 'sandbox.asaas.com' : 'asaas.com'
  if (rawLink) {
    const link = new URL(rawLink)
    if (link.protocol !== 'https:' || ![expectedHost, `www.${expectedHost}`].includes(link.hostname))
      throw new Error('URL de checkout inválida.')
    return link.toString()
  }
  return `https://${expectedHost}/checkoutSession/show/${encodeURIComponent(id)}`
}

export async function createAsaasCheckout(input: {
  orderId: string
  name: string
  description: string
  amount: number
  successPath: string
  cancelPath: string
  expiredPath: string
  email?: string | null
}) {
  const origin = billingOrigin()
  if (!origin.startsWith('https://'))
    throw new Error('O checkout Asaas exige APP_URL HTTPS. No desenvolvimento, abra o app por um túnel HTTPS.')
  const checkout = await request<AsaasCheckout>('/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['DETACHED'],
      minutesToExpire: 60,
      externalReference: input.orderId,
      callback: {
        successUrl: `${origin}${input.successPath}`,
        cancelUrl: `${origin}${input.cancelPath}`,
        expiredUrl: `${origin}${input.expiredPath}`,
      },
      items: [{ name: input.name, description: input.description, quantity: 1, value: input.amount / 100 }],
      // Asaas recolhe CPF e nome do pagador no próprio Checkout. Não envie customerData incompleto.
    }),
  })
  if (
    !/^[a-f0-9-]{36}$/i.test(checkout.id) ||
    checkout.externalReference && checkout.externalReference !== input.orderId ||
    checkout.status && checkout.status !== 'ACTIVE' ||
    checkout.billingTypes && (!checkout.billingTypes.includes('PIX') || !checkout.billingTypes.includes('CREDIT_CARD') || checkout.billingTypes.length !== 2) ||
    checkout.chargeTypes && (checkout.chargeTypes.length !== 1 || checkout.chargeTypes[0] !== 'DETACHED')
  )
    throw new Error('Checkout não corresponde ao pedido.')
  return { id: checkout.id, url: asaasCheckoutUrl(checkout.id, checkout.link) }
}

export async function getAsaasCheckoutPayments(id: string) {
  const response = await request<{ data: AsaasPayment[]; hasMore?: boolean }>(`/payments?checkoutSession=${encodeURIComponent(id)}&limit=10`)
  if (response.hasMore) throw new Error('Checkout com cobranças demais.')
  return response.data || []
}

export async function getAsaasPayment(id: string) {
  return request<AsaasPayment>(`/payments/${encodeURIComponent(id)}`)
}

export async function getAsaasCustomerEmail(id: string) {
  const customer = await request<{ email?: string | null }>(`/customers/${encodeURIComponent(id)}`)
  return customer.email?.trim().toLowerCase() || ''
}

export async function refundAsaasPayment(id: string) {
  return request<AsaasPayment>(`/payments/${encodeURIComponent(id)}/refund`, { method: 'POST', body: '{}' })
}

export function validAsaasWebhookToken(token: string | null) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN
  if (!expected || expected.length < 32 || !token) return false
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
