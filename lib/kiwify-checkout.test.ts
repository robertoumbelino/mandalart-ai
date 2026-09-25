import { afterEach, describe, expect, it, vi } from 'vitest'
import { kiwifyCheckoutLink } from './kiwify-checkout'

vi.mock('server-only', () => ({}))

const orderId = '60e62b8f-e9ac-4f97-94e8-6d27732fbd5e'
const original = process.env.KIWIFY_CHECKOUT_ONE

afterEach(() => {
  if (original === undefined) delete process.env.KIWIFY_CHECKOUT_ONE
  else process.env.KIWIFY_CHECKOUT_ONE = original
})

describe('Kiwify offer link preparation', () => {
  it('keeps the affiliate link and adds the buyer and order reference', () => {
    process.env.KIWIFY_CHECKOUT_ONE =
      'https://pay.kiwify.com.br/abc123?afid=partner&src=campaign'
    const url = new URL(kiwifyCheckoutLink(1, 'buyer@example.com', orderId))
    expect(url.searchParams.get('afid')).toBe('partner')
    expect(url.searchParams.get('src')).toBe('campaign')
    expect(url.searchParams.get('email')).toBe('buyer@example.com')
    expect(url.searchParams.get('sck')).toBe(orderId)
  })

  it.each([
    'https://example.com/abc123',
    'http://pay.kiwify.com.br/abc123',
    'https://pay.kiwify.com.br.evil.test/abc123',
    'https://pay.kiwify.com.br/abc123#fragment',
  ])('rejects non-checkout URL %s', (value) => {
    process.env.KIWIFY_CHECKOUT_ONE = value
    expect(() => kiwifyCheckoutLink(1, 'buyer@example.com', orderId)).toThrow(
      'Link de checkout da Kiwify inválido.',
    )
  })

  it('rejects a reference that cannot identify an order', () => {
    process.env.KIWIFY_CHECKOUT_ONE = 'https://pay.kiwify.com.br/abc123'
    expect(() => kiwifyCheckoutLink(1, 'buyer@example.com', 'not-an-id')).toThrow(
      'Pedido da Kiwify inválido.',
    )
  })
})
