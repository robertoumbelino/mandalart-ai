'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Clock3, Tag } from 'lucide-react'
import { formatBRL } from '@/lib/dream-packs'
import { salesOffer, SALES_PROMOTION, type SalesOfferClock } from '@/lib/sales-offer'

const ClockContext = createContext<SalesOfferClock>({ now: 0, enabled: false })
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
  return <OfferContext value={offer}><ClockContext value={clock}>{children}</ClockContext></OfferContext>
}

export function useSalesOffer() {
  return useContext(OfferContext)
}

export function PromotionCountdown({ compact = false }: { compact?: boolean }) {
  const clock = useContext(ClockContext)
  const { active, remainingSeconds } = salesOffer(clock.now, clock.enabled)
  if (!active) return null
  const units = [
    [Math.floor(remainingSeconds / 86400), 'dias'],
    [Math.floor(remainingSeconds / 3600) % 24, 'horas'],
    [Math.floor(remainingSeconds / 60) % 60, 'min'],
    [remainingSeconds % 60, 'seg'],
  ] as const
  return <div className={`promotion-countdown ${compact ? 'promotion-countdown--compact' : ''}`}>
    <span className="promotion-clock-label"><Clock3 size={14} aria-hidden="true" /> A oferta termina em</span>
    <div className="promotion-digits" role="timer" aria-label="Tempo restante até 25 de outubro, às 23h59, horário de Brasília" aria-live="off">
      {units.map(([value, label]) => <span key={label}><strong>{String(value).padStart(2, '0')}</strong><small>{label}</small></span>)}
    </div>
  </div>
}

export function PromotionBanner() {
  const { active } = useSalesOffer()
  if (!active) return null
  return <aside className="promotion-banner" aria-label="Oferta por tempo limitado">
    <div className="promotion-banner-copy"><span className="promotion-banner-icon"><Tag size={19} aria-hidden="true" /></span><div><strong>Seu plano com 46% OFF</strong><span>R$ 19,90 · só até 25/10</span></div></div>
    <PromotionCountdown compact />
  </aside>
}

export function PromotionPrice({ hero = false }: { hero?: boolean }) {
  const { active, price } = useSalesOffer()
  return <div className={`promotion-price ${hero ? 'promotion-price--hero' : ''}`}>
    {active && <div className="promotion-price-before"><s>{formatBRL(SALES_PROMOTION.regularAmount)}</s><span>46% OFF</span></div>}
    <strong>{price}</strong>
    <small>Pagamento único · sem assinatura</small>
    {active && <p>Você economiza <b>R$ 17,10</b> para dar o primeiro passo.</p>}
  </div>
}
