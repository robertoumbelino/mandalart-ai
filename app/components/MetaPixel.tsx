'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { captureAttribution } from '@/lib/attribution'
import { discardMetaEvents, flushMetaEvents } from '@/lib/meta-events'
import { MARKETING_CONSENT_KEY } from '@/lib/marketing-consent'
import './meta-pixel.css'

const PRODUCTION_HOSTS = new Set(['mandalart.com.br', 'www.mandalart.com.br', 'mandalart-ai.vercel.app'])

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export function MetaPixel() {
  const pathname = usePathname()
  const hideConsentBanner = pathname === '/comecar' || pathname.startsWith('/comecar/')
  const [consent, setConsent] = useState<'accepted' | 'rejected' | null>(null)
  const [ready, setReady] = useState(false)
  const [decided, setDecided] = useState(false)
  const [production, setProduction] = useState(false)

  useEffect(() => {
    captureAttribution()
  }, [pathname])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setProduction(PRODUCTION_HOSTS.has(window.location.hostname))
      try {
        const saved = localStorage.getItem(MARKETING_CONSENT_KEY)
        if (saved === 'accepted' || saved === 'rejected') setConsent(saved)
      } catch {
        // The preference can still be selected when storage is unavailable.
      }
      setDecided(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (production && ready && consent === 'accepted') {
      window.fbq?.('track', 'PageView')
      flushMetaEvents()
    }
  }, [pathname, production, ready, consent])

  function choose(value: 'accepted' | 'rejected') {
    try { localStorage.setItem(MARKETING_CONSENT_KEY, value) } catch {}
    if (value === 'rejected') discardMetaEvents()
    setConsent(value)
  }

  return (
    <>
    {production && consent === 'accepted' && <Script id="meta-pixel" strategy="afterInteractive" onReady={() => setReady(true)}>
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','975897138891298');`}
    </Script>}
    {production && decided && consent === null && !hideConsentBanner && <aside className="marketing-consent" aria-label="Preferências de cookies">
      <div>
        <strong>Podemos usar cookies opcionais?</strong>
        <p>Eles ajudam a medir o desempenho dos nossos anúncios. Você pode aceitar ou recusar sem mudar o uso do site. <a href="/privacidade">Saiba mais</a>.</p>
      </div>
      <div className="marketing-consent-actions">
        <button type="button" onClick={() => choose('rejected')}>Recusar</button>
        <button type="button" onClick={() => choose('accepted')}>Aceitar</button>
      </div>
    </aside>}
    </>
  )
}
