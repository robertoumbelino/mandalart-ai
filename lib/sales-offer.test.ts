import { describe, expect, it } from 'vitest'
import { guestAmount, salesOffer } from './sales-offer'

describe('October promotion uses the same fixed Brasília deadline for everyone', () => {
  it.each([
    ['2026-10-18T23:59:59-03:00', false, 3700],
    ['2026-10-19T00:00:00-03:00', true, 1990],
    ['2026-10-25T23:59:59-03:00', true, 1990],
    ['2026-10-26T02:59:59.999Z', true, 1990],
    ['2026-10-26T03:00:00Z', false, 3700],
    ['2026-11-25T12:00:00-03:00', false, 3700],
  ])('%s has active=%s and amount=%i', (date, active, amount) => {
    expect(salesOffer(Date.parse(date))).toMatchObject({ active, amount })
  })
  it('does not advertise a discount for an unsupported payment provider', () => {
    expect(salesOffer(Date.parse('2026-10-20T12:00:00-03:00'), false)).toMatchObject({ active: false, amount: 3700, remainingSeconds: 0 })
  })
  it('keeps the three-pack at R$ 99 and never resets the deadline per visit', () => {
    const now = Date.parse('2026-10-25T23:59:00-03:00')
    expect(guestAmount(false, now)).toBe(1990)
    expect(guestAmount(true, now)).toBe(9900)
    expect(salesOffer(now).remainingSeconds).toBe(60)
    expect(salesOffer(now + 30_000).remainingSeconds).toBe(30)
    expect(guestAmount(false, now + 60_000)).toBe(3700)
  })
})
