'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { trackMetaEvent } from '@/lib/meta-events'
import { captureProductEvent } from '@/lib/posthog'

type Result = {
  status: 'pending' | 'expired' | 'paid'
  id?: string
  amount?: number
  credits?: number
  accessEmailSent?: boolean
  emailVerificationRequired?: boolean
}

export function PurchaseReturn() {
  const [result, setResult] = useState<Result>({ status: 'pending' })
  const [error, setError] = useState('')

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    if (!sessionId) return
    let active = true
    let count = 0
    let timer: ReturnType<typeof setTimeout>

    const check = async () => {
      try {
        const response = await fetch(`/api/onboarding/payment?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Não foi possível confirmar o pagamento agora.')
        const payment = await response.json() as Result
        if (!active) return
        setResult(payment)
        setError('')
        if (payment.status === 'paid' && payment.id) {
          captureProductEvent('purchase_completed', { order_id: payment.id, amount: payment.amount || 0 })
          if (payment.credits === 3) captureProductEvent('order_bump_accepted', { order_id: payment.id })
          trackMetaEvent({ name: 'Purchase', data: { value: (payment.amount || 0) / 100, currency: 'BRL' }, onceKey: `purchase.${payment.id}`, eventId: `purchase-${payment.id}` })
        }
        if (payment.status === 'pending' && count++ < 20) timer = setTimeout(check, 3000)
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
        <span style={{ color: '#6334ff', fontWeight: 800, fontSize: 12, letterSpacing: '.12em' }}>MANDALART.AI</span>
        <h1 style={{ fontSize: 'clamp(28px, 7vw, 36px)', lineHeight: 1.15, margin: '18px 0 12px' }}>
          {paid ? 'Seu Mandalart está liberado.' : result.status === 'expired' ? 'Este pagamento expirou.' : 'Confirmando seu pagamento…'}
        </h1>
        {paid ? (
          <>
            <p style={{ lineHeight: 1.55, color: '#56617a' }}>Seu primeiro sonho está salvo. {result.emailVerificationRequired
              ? result.accessEmailSent
                ? 'Esse e-mail já tem uma conta. Enviamos um link para confirmar que ela é sua.'
                : 'Esse e-mail já tem uma conta. Ainda não conseguimos enviar o link de acesso.'
              : result.accessEmailSent
                ? 'Enviamos um link para você abrir sua conta também em outro aparelho.'
                : 'Você já pode continuar neste aparelho. O link por e-mail ainda não foi enviado.'}</p>
            {result.credits === 3 && <p style={{ padding: '12px 14px', borderRadius: 12, background: '#f2edff', fontWeight: 700, color: '#5134be' }}>Seus 2 Mandalarts adicionais estão disponíveis.</p>}
            {!result.emailVerificationRequired && <Link href="/?continuar=sonho" style={{ display: 'block', marginTop: 24, padding: '16px', textAlign: 'center', borderRadius: 12, background: '#6334ff', color: 'white', fontWeight: 700, textDecoration: 'none' }}>Abrir meu Mandalart</Link>}
            {emailMissing && <button onClick={() => window.location.reload()} style={{ display: 'block', width: '100%', marginTop: 14, border: '1px solid #c9baff', borderRadius: 10, padding: '12px 17px', color: '#5134be', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Tentar enviar o link novamente</button>}
          </>
        ) : (
          <>
            <p style={{ lineHeight: 1.55, color: '#56617a' }}>Se você acabou de pagar, esta confirmação pode levar alguns segundos. Não feche a página.</p>
            {error && <p role="alert" style={{ color: '#b42318' }}>{error}</p>}
            <button onClick={() => window.location.reload()} style={{ marginTop: 18, border: '1px solid #c9baff', borderRadius: 10, padding: '12px 17px', color: '#5134be', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Verificar novamente</button>
          </>
        )}
      </section>
    </main>
  )
}
