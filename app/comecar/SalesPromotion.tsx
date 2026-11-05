'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatBRL } from '@/lib/dream-packs'
import { salesOffer, SALES_PROMOTION, type SalesOfferClock } from '@/lib/sales-offer'

const OfferContext = createContext({ active: false, amount: 3700, price: 'R$ 37,00' })

export function SalesPromotionProvider({ initialClock, children }: { initialClock: SalesOfferClock; children: ReactNode }) {
  const [clock, setClock] = useState(initialClock)
  useEffect(() => {
    const started = performance.now()
    const update = () => setClock({ enabled: initialClock.enabled, now: initialClock.now + performance.now() - started })
    const interval = setInterval(update, 1000)
    window.addEventListener('pageshow', update)
    document.addEventListener('visibilitychange', update)
    return () => { clearInterval(interval); window.removeEventListener('pageshow', update); document.removeEventListener('visibilitychange', update) }
  }, [initialClock])
  const { active, amount } = salesOffer(clock.now, clock.enabled)
  const offer = useMemo(() => ({ active, amount, price: formatBRL(amount) }), [active, amount])
  return <OfferContext value={offer}>{children}</OfferContext>
}

export function useSalesOffer() {
  return useContext(OfferContext)
}

export function PromotionBadge() {
  return <span className="promotion-badge" aria-label="Esquenta Black Friday">
    <span className="promotion-badge-fire" aria-hidden="true">🔥</span>
    <span className="promotion-badge-copy"><span>ESQUENTA</span><strong>BLACK FRIDAY</strong></span>
  </span>
}

export function PromotionBanner() {
  const { active } = useSalesOffer()
  if (!active) return null
  return <aside className="promotion-banner" aria-label="Esquenta Black Friday">
    <div className="promotion-banner-copy"><PromotionBadge /><p>46% OFF · R$ 19,90 · até 30/11</p></div>
  </aside>
}

export function PromotionPrice() {
  const { active, price } = useSalesOffer()
  return <div className="promotion-price">
    {active && <div className="promotion-price-before"><s>{formatBRL(SALES_PROMOTION.regularAmount)}</s><span>46% OFF</span></div>}
    <strong>{price}</strong>
    <small>Pagamento único · sem assinatura</small>
    {active && <p>Você economiza <b>R$ 17,10</b> para dar o primeiro passo.</p>}
  </div>
}
