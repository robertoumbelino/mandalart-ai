export const SALES_PROMOTION = {
  startsAt: '2026-10-19T00:00:00-03:00',
  endsAt: '2026-10-26T00:00:00-03:00',
  regularAmount: 3700,
  amount: 1990,
} as const

export type SalesOfferClock = { now: number; enabled: boolean }

export function salesOffer(now: number, enabled = true) {
  const active = enabled && now >= Date.parse(SALES_PROMOTION.startsAt) && now < Date.parse(SALES_PROMOTION.endsAt)
  return {
    active,
    amount: active ? SALES_PROMOTION.amount : SALES_PROMOTION.regularAmount,
    remainingSeconds: active ? Math.ceil((Date.parse(SALES_PROMOTION.endsAt) - now) / 1000) : 0,
  }
}

export function guestAmount(bump: boolean, now = Date.now(), expectedAmount?: number) {
  const amount = bump ? 9900 : salesOffer(now).amount
  if (expectedAmount !== undefined && amount !== expectedAmount)
    throw new Error('O preço da oferta mudou. Confira o valor atualizado e tente novamente.')
  return amount
}
