import 'server-only'
import jwt from 'jsonwebtoken'
import { billingOrigin } from '@/lib/stripe'

function secret() {
  const value = process.env.JWT_SECRET
  if (!value || value.length < 32) throw new Error('JWT_SECRET não configurado.')
  return value
}

export function createLeadLink(leadId: string) {
  const token = jwt.sign({}, secret(), { subject: leadId, audience: 'mandalart-lead', expiresIn: '7d', algorithm: 'HS256' })
  return `${billingOrigin()}/api/onboarding/resume?token=${encodeURIComponent(token)}`
}

export function verifyLeadLink(token: string) {
  const payload = jwt.verify(token, secret(), { audience: 'mandalart-lead', algorithms: ['HS256'] })
  if (typeof payload === 'string' || !payload.sub || !/^[a-f\d-]{36}$/i.test(payload.sub)) throw new Error('Link inválido.')
  return payload.sub
}

export function createUnsubscribeLink(leadId: string) {
  const token = jwt.sign({}, secret(), { subject: leadId, audience: 'mandalart-unsubscribe', expiresIn: '30d', algorithm: 'HS256' })
  return `${billingOrigin()}/api/onboarding/unsubscribe?token=${encodeURIComponent(token)}`
}

export function verifyUnsubscribeLink(token: string) {
  const payload = jwt.verify(token, secret(), { audience: 'mandalart-unsubscribe', algorithms: ['HS256'] })
  if (typeof payload === 'string' || !payload.sub || !/^[a-f\d-]{36}$/i.test(payload.sub)) throw new Error('Link inválido.')
  return payload.sub
}
