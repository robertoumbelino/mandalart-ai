'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, ShieldCheck } from 'lucide-react'
import { BrandLogo } from '@/app/components/Brand'

type PixState = {
  id: string
  status: string
  amount: number
  credits: number
  email?: string
  source: 'comecar' | 'account'
  expiresAt: string
  accessEmailSent: boolean
  simulated?: boolean
  canSimulate?: boolean
  payload?: string
  image?: string
}

export function PixPayment() {
  const [payment, setPayment] = useState<PixState | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('order_id')
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        if (!id) throw new Error('Pedido não encontrado. Volte à sua prévia para tentar novamente.')
        const response = await fetch(`/api/asaas/pix?order_id=${encodeURIComponent(id)}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Não conseguimos consultar seu Pix. Atualize a página para tentar novamente.')
        const result = await response.json() as PixState
        if (!active) return
        setPayment(result)
        setError('')
        if (result.status === 'pending') timer = setTimeout(refresh, 4000)
      } catch (cause) {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Falha ao consultar o Pix.')
        if (id) timer = setTimeout(refresh, 8000)
      }
    }
    void refresh()
    return () => { active = false; clearTimeout(timer) }
  }, [])

  useEffect(() => {
    const expiresAt = payment?.expiresAt
    if (!expiresAt || payment?.status !== 'pending') return
    function tick() { setSecondsLeft(Math.max(0, Math.ceil((new Date(expiresAt!).getTime() - Date.now()) / 1000))) }
    const timer = setInterval(tick, 1000)
    const initial = setTimeout(tick, 0)
    return () => { clearInterval(timer); clearTimeout(initial) }
  }, [payment?.expiresAt, payment?.status])

  const returnUrl = payment?.source === 'comecar'
    ? `/compra?order_id=${encodeURIComponent(payment.id)}`
    : `/sonhos?asaas_order=${encodeURIComponent(payment?.id || '')}`
  const backUrl = payment?.source === 'account' ? '/sonhos' : '/comecar'
  const formattedAmount = payment ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount / 100) : ''
  const remaining = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`

  async function copyCode() {
    if (!payment?.payload) return
    try {
      await navigator.clipboard.writeText(payment.payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch { setError('Não foi possível copiar automaticamente. Selecione o código abaixo para copiar.') }
  }

  async function simulatePayment() {
    if (!payment?.canSimulate || simulating) return
    setSimulating(true)
    setError('')
    try {
      const response = await fetch(`/api/asaas/pix?order_id=${encodeURIComponent(payment.id)}`, { method: 'POST' })
      const result = await response.json() as { status?: string; error?: string }
      if (!response.ok || result.status !== 'paid') throw new Error(result.error || 'Não foi possível simular a confirmação.')
      window.location.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha na simulação.')
      setSimulating(false)
    }
  }

  return <main className="pix-page">
    <header className="pix-header"><Link href="/" aria-label="Mandalart, início"><BrandLogo iconSize={29} /></Link></header>
    <section className="pix-card" aria-live="polite">
      {!payment && !error && <div className="pix-loading"><Loader2 className="animate-spin" /><p>Preparando seu Pix…</p></div>}
      {error && <p className="pix-alert" role="alert">{error}</p>}
      {payment?.status === 'pending' && <>
        <span className="pix-kicker">PAGAMENTO ÚNICO</span>
        <h1>Seu Pix está pronto.</h1>
        <p className="pix-lead">Escaneie o QR Code ou copie o código para pagar pelo aplicativo do seu banco.</p>
        <div className="pix-amount"><span>{payment.credits === 3 ? '3 Mandalarts completos' : 'Mandalart completo'}</span><strong>{formattedAmount}</strong></div>
        {payment.image && <div className="pix-qr"><Image src={`data:image/png;base64,${payment.image}`} alt="QR Code Pix deste pedido" width={260} height={260} unoptimized /></div>}
        <button className="pix-copy" onClick={copyCode} disabled={!payment.payload}>{copied ? <Check size={19} /> : <Copy size={19} />}{copied ? 'Código copiado' : 'Copiar código Pix'}</button>
        <label className="pix-code-label" htmlFor="pix-code">Pix Copia e Cola</label>
        <textarea id="pix-code" readOnly value={payment.payload || ''} onFocus={event => event.currentTarget.select()} />
        <div className="pix-wait"><Loader2 size={17} className="animate-spin" /><span>Aguardando a confirmação do pagamento</span><strong>{remaining}</strong></div>
        <p className="pix-note"><ShieldCheck size={17} /> O QR Code é exclusivo deste pedido. {payment.email ? `Após a confirmação, enviaremos o acesso para ${payment.email}.` : 'Seus créditos entram na sua conta após a confirmação.'}</p>
        {payment.canSimulate && <div className="pix-local-simulation"><strong>Quer ver o que acontece depois?</strong><p>Confirme esta compra fictícia no banco de dados local, sem pagar o QR Code.</p><button type="button" onClick={simulatePayment} disabled={simulating}>{simulating ? 'Simulando confirmação…' : 'Simular pagamento local'}</button></div>}
      </>}
      {payment?.status === 'paid' && <div className="pix-result"><span className="pix-success-icon"><Check size={28} /></span><h1>{payment.simulated ? 'Simulação concluída!' : 'Pagamento confirmado!'}</h1><p>{payment.simulated ? 'Este pedido foi marcado como pago apenas no ambiente local. Nenhum pagamento foi realizado. ' : ''}{payment.source === 'comecar' ? 'Continue para conferir a experiência de acesso.' : 'Os créditos foram adicionados à sua conta.'}</p><Link className="pix-copy" href={returnUrl}>Continuar <ArrowRight size={18} /></Link></div>}
      {payment && payment.status !== 'pending' && payment.status !== 'paid' && <div className="pix-result"><h1>{payment.status === 'expired' ? 'Este Pix expirou.' : 'Pagamento não concluído.'}</h1><p>Você pode voltar e gerar um novo código para tentar novamente.</p><Link className="pix-copy" href={backUrl}>Voltar <ArrowLeft size={18} /></Link></div>}
    </section>
  </main>
}
