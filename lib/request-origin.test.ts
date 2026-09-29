import { expect, it } from 'vitest'
import { isSameOrigin } from './request-origin'
it('accepts the public host when Next normalizes the internal URL', () => {
  expect(isSameOrigin(new Request('http://localhost:3100/api/test', { headers: { origin: 'https://mandalart.com.br', host: 'mandalart.com.br' } }))).toBe(true)
})
it.each([null, 'null', 'https://evil.example', 'https://mandalart.com.br.evil.example', 'https://mandalart.com.br/path'])('rejects an untrusted origin %s', origin => {
  expect(isSameOrigin(new Request('https://mandalart.com.br/api/test', { headers: { host: 'mandalart.com.br', ...(origin ? { origin } : {}) } }))).toBe(false)
})
