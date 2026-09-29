import { expect, it } from 'vitest'
import { purchaseEmail, previewEmail } from './email-template'

it('escapes order content and URLs without losing the access links', () => {
  const html = purchaseEmail('R$ 37,00 <script>', 1, 'https://example.com/register?token=a&b=c', 'https://example.com/login', 'https://example.com/renew')

  expect(html).toContain('R$ 37,00 &lt;script&gt;')
  expect(html).not.toContain('<script>')
  expect(html).toContain('href="https://example.com/register?token=a&amp;b=c"')
  expect(html).toContain('href="https://example.com/login"')
  expect(html).toContain('href="https://example.com/renew"')
})

it('keeps the unsubscribe link in the preview email', () => {
  const html = previewEmail('Seu caminho', 'https://example.com/preview', 'Seu primeiro passo.', 'https://example.com/unsubscribe')

  expect(html).toContain('href="https://example.com/unsubscribe"')
  expect(html).toContain('O plano completo é opcional.')
})
