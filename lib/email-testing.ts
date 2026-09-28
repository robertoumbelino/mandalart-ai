const RESEND_TEST_ADDRESSES = new Set([
  'delivered@resend.dev',
  'bounced@resend.dev',
  'complained@resend.dev'
])

export function localEmailTestMode() {
  return process.env.NODE_ENV !== 'production' || process.env.LOCAL_DATABASE_ONLY === 'true'
}

export function allowedLocalEmailRecipient(email: string) {
  return RESEND_TEST_ADDRESSES.has(email.trim().toLowerCase())
}
