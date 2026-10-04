'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/app/components/Brand'
import { PaymentSupport } from '@/app/components/PaymentSupport'
import { trackMetaEvent } from '@/lib/meta-events'
import { sendGoogleAnalyticsEvent } from '@/app/components/GoogleAnalytics'
import { captureProductEvent } from '@/lib/posthog'
import { markOnboardingPurchased } from '@/lib/onboarding-storage'

type Result = {
  status: 'pending' | 'expired' | 'failed' | 'paid'
  mode?: 'test' | 'live'
  journeyVersion?: string
  previewId?: string
  dream?: string
  id?: string
  amount?: number
  credits?: number
  accessEmailSent?: boolean
  registrationRequired?: boolean
  authenticated?: boolean
  simulated?: boolean
}

export function PurchaseReturn() {
  const [result, setResult] = useState<Result>({ status: 'pending' })
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    const kiwify = params.has('kiwify')
    let orderId = kiwify ? null : params.get('order_id')
    if (kiwify) {
      try { orderId = sessionStorage.getItem('mandalart_kiwify_guest_order') } catch {}
      if (!orderId) try { orderId = localStorage.getItem('mandalart_kiwify_guest_order') } catch {}
      if (!orderId) orderId = params.get('sck')
    }
    if (!sessionId && !orderId) {
      queueMicrotask(() => setError('Não encontramos a referência da compra neste navegador. Confira o e-mail usado no pagamento para receber seu acesso.'))
      return
    }
    let active = true
    let count = 0
    let timer: ReturnType<typeof setTimeout>

    const check = async () => {
      try {
        const response = await fetch(`/api/onboarding/payment?${orderId ? `order_id=${encodeURIComponent(orderId)}${kiwify ? '&provider=kiwify' : ''}` : `session_id=${encodeURIComponent(sessionId!)}`}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Não foi possível confirmar o pagamento agora.')
        const payment = await response.json() as Result
        if (!active) return
        setResult(payment)
        setError('')
        if (payment.status === 'paid' && payment.id) {
          if (kiwify) {
            try { sessionStorage.removeItem('mandalart_kiwify_guest_order') } catch {}
            try { localStorage.removeItem('mandalart_kiwify_guest_order') } catch {}
          }
          if (payment.previewId) markOnboardingPurchased(payment.previewId)
          const purchase = { transaction_id: payment.id, order_id: payment.id, preview_id: payment.previewId || '', currency: 'BRL', value: (payment.amount || 0) / 100, journey_version: payment.journeyVersion || 'conversion-v2' }
          let alreadySent = false
          try { alreadySent = localStorage.getItem(`mandalart.purchase.analytics.${payment.id}`) === '1' } catch {}
          if (!alreadySent) {
            captureProductEvent('purchase_returned', purchase)
            if (payment.mode === 'live') sendGoogleAnalyticsEvent('purchase', { ...purchase, items: [
              { item_id: 'mandalart-one', item_name: 'Mandalart completo', price: 37, quantity: 1 },
              ...(payment.credits === 3 ? [{ item_id: 'mandalart-bump-two', item_name: 'Mais 2 Mandalarts', price: 62, quantity: 1 }] : []),
            ] })
            try { localStorage.setItem(`mandalart.purchase.analytics.${payment.id}`, '1') } catch {}
          }
          if (!alreadySent && payment.credits === 3) captureProductEvent('order_bump_returned', { order_id: payment.id })
          if (payment.mode === 'live') trackMetaEvent({ name: 'Purchase', data: { value: (payment.amount || 0) / 100, currency: 'BRL' }, onceKey: `purchase.${payment.id}`, eventId: `purchase-${payment.id}` })
        }
        if ((payment.status === 'pending' || (payment.status === 'paid' && !payment.accessEmailSent)) && count++ < 20) timer = setTimeout(check, 3000)
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Tente novamente.')
      }
    }

    void check()
    return () => { active = false; clearTimeout(timer) }
  }, [])

  const paid = result.status === 'paid'
  const emailMissing = paid && !result.accessEmailSent

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f8f7ff', color: '#24304a' }}>
      <section style={{ width: '100%', maxWidth: 520, padding: 'clamp(24px, 6vw, 36px)', background: '#fff', border: '1px solid #e7e2f4', borderRadius: 22, boxShadow: '0 20px 55px #24204a13' }}>
        <BrandLogo iconSize={28} />
        <h1 style={{ fontSize: 'clamp(28px, 7vw, 36px)', lineHeight: 1.15, margin: '18px 0 12px' }}>
          {paid ? result.simulated ? 'Simulação concluída!' : 'Compra confirmada!' : result.status === 'expired' ? 'Este pagamento expirou.' : result.status === 'failed' ? 'O pagamento não foi confirmado.' : 'Confirmando seu pagamento…'}
        </h1>
        {paid ? (
          <>
            {result.simulated && <p style={{ margin: '0 0 14px', padding: 12, borderRadius: 10, background: '#fff5db', color: '#6d4d10', fontSize: 13, lineHeight: 1.5 }}>Este pedido foi marcado como pago apenas no banco local. Nenhuma cobrança real foi feita.</p>}
            <p style={{ lineHeight: 1.55, color: '#56617a' }}>Seu objetivo{result.dream ? ` — ${result.dream}` : ''} e sua compra estão salvos. {result.registrationRequired
              ? result.accessEmailSent ? result.journeyVersion === 'sales-v3' ? 'Enviamos um e-mail para você concluir seu cadastro. Depois, responda às perguntas específicas para gerar seu plano.' : 'Enviamos um e-mail para você concluir seu cadastro. Depois, seu Mandalart abre com o plano completo.' : 'Falta concluir seu cadastro. Ainda não conseguimos enviar o e-mail; tente novamente abaixo.'
              : result.journeyVersion === 'sales-v3' ? 'Entre com sua conta para responder às perguntas específicas e gerar seu plano. Nas próximas visitas, use o mesmo acesso.' : 'Entre com sua conta para abrir seu Mandalart. Nas próximas visitas, use o mesmo e-mail e senha ou Google.'}</p>
            {result.registrationRequired && <p style={{ marginTop: 16, padding: 14, borderRadius: 12, background: '#f2edff', color: '#5134be', fontSize: 14 }}>Abra o e-mail da compra e clique em <strong>Concluir meu cadastro</strong>. {result.simulated ? 'Neste teste, o acesso ficou salvo no banco local.' : 'Pode fechar esta página: sua compra está garantida.'}{process.env.NODE_ENV === 'development' && <span style={{ display: 'block', marginTop: 8 }}>Teste local: o e-mail está simulado no painel do Resend, identificado pelo endereço informado na compra.</span>}</p>}
            {result.credits === 3 && <p style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: '#f2edff', fontWeight: 700, color: '#5134be' }}>Seus 2 Mandalarts adicionais estão disponíveis.</p>}
            {!result.registrationRequired && <Link href={result.authenticated ? '/?continuar=sonho' : '/?entrar=1&continuar=sonho'} className="brand-button" style={{ display: 'block', marginTop: 24, padding: '16px', textAlign: 'center', borderRadius: 12, color: 'white', fontWeight: 700, textDecoration: 'none' }}>{result.authenticated ? 'Abrir meu Mandalart' : 'Entrar na minha conta'}</Link>}
            {result.registrationRequired && result.accessEmailSent && <Link href="/acessar" style={{ display: 'block', marginTop: 20, color: '#5134be', textAlign: 'center' }}>Não encontrou o e-mail? Solicitar outro</Link>}
            {emailMissing && <button onClick={() => window.location.reload()} style={{ display: 'block', width: '100%', marginTop: 14, border: '1px solid #c9baff', borderRadius: 10, padding: '12px 17px', color: '#5134be', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Tentar enviar o link novamente</button>}
          </>
        ) : (
          <>
            <p style={{ lineHeight: 1.55, color: '#56617a' }}>{result.status === 'pending' ? 'A confirmação pode levar alguns instantes. Seu objetivo continua salvo. Assim que o pagamento for confirmado, enviaremos seu acesso por e-mail.' : 'Seu objetivo continua salvo. Volte para tentar novamente com outro pagamento.'}</p>
            {result.status !== 'pending' && <Link href="/comecar?cancelado=1">Voltar ao meu objetivo</Link>}
            {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
            {(error || result.status === 'failed') && <PaymentSupport />}
            <button onClick={() => window.location.reload()} style={{ marginTop: 18, border: '1px solid #c9baff', borderRadius: 10, padding: '12px 17px', color: '#5134be', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Verificar novamente</button>
          </>
        )}
      </section>
    </main>
  )
}
