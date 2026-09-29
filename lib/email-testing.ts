import { createHash } from 'node:crypto'

export function localEmailTestMode() {
  return process.env.NODE_ENV !== 'production' || process.env.LOCAL_DATABASE_ONLY === 'true'
}

export function allowedLocalEmailRecipient(email: string) {
  // Official Resend simulation aliases; never permit another recipient or domain.
  return /^(delivered|bounced|complained)(\+[a-z0-9_-]{1,80})?@resend\.dev$/i.test(email.trim())
}

export function emailDeliveryRecipient(email: string) {
  if (!localEmailTestMode()) return email
  const normalized = email.trim().toLowerCase()
  if (allowedLocalEmailRecipient(normalized)) return normalized
  const label = normalized.split('@')[0].replace(/[^a-z0-9_-]/g, '-').slice(0, 24) || 'email'
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 12)
  return `delivered+${label}-${hash}@resend.dev`
}
