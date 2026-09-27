'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { captureAttribution } from '@/lib/attribution'
import { discardMetaEvents, flushMetaEvents } from '@/lib/meta-events'
import { ANALYTICS_CONSENT_EVENT, ANALYTICS_CONSENT_KEY, startPostHog } from '@/lib/posthog'
import './meta-pixel.css'

const PRODUCTION_HOSTS = new Set(['mandalart.com.br', 'www.mandalart.com.br', 'mandalart-ai.vercel.app'])

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export function MetaPixel() {
  const pathname = usePathname()
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
        const saved = localStorage.getItem(ANALYTICS_CONSENT_KEY)
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
    try {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, value)
    } catch {
      // The choice still applies during this visit.
    }
    if (value === 'rejected') discardMetaEvents()
    if (value === 'accepted') startPostHog()
    setConsent(value)
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT))
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
    {(production || Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN)) && decided && consent === null && <aside className="marketing-consent" aria-label="Preferência de privacidade">
      <div>
        <strong>Você escolhe sobre anúncios e gravações.</strong>
        <p>Com sua permissão, a Meta mede anúncios e o PostHog analisa a jornada e gravações com textos e campos ocultos. Recusar não muda o uso do site. <a href="/privacidade">Saiba mais</a>.</p>
      </div>
      <div className="marketing-consent-actions">
        <button type="button" onClick={() => choose('rejected')}>Recusar</button>
        <button type="button" onClick={() => choose('accepted')}>Aceitar</button>
      </div>
    </aside>}
    </>
  )
}
