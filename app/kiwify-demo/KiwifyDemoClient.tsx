'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrandLogo } from '@/app/components/Brand'
import { completeKiwifyDemoOrder, getKiwifyDemoOrder } from '@/actions/kiwify-demo'
import { formatBRL } from '@/lib/dream-packs'

type Order = Awaited<ReturnType<typeof getKiwifyDemoOrder>>

export default function KiwifyDemoPage() {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [method, setMethod] = useState<'pix' | 'card'>('pix')

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('order_id') || ''
    void getKiwifyDemoOrder(id).then(setOrder).catch(cause => setError(cause instanceof Error ? cause.message : 'Pedido de teste indisponível.'))
  }, [])

  async function complete() {
    if (!order || busy) return
    setBusy(true)
    setError('')
    try {
      await completeKiwifyDemoOrder(order.id, email, method)
      router.push('/compra?kiwify&demo=1')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a simulação.')
      setBusy(false)
    }
  }

  return <main className="min-h-screen bg-[#f8f7ff] px-4 py-10 text-[#24304a]">
    <div className="mx-auto max-w-lg rounded-3xl border border-[#e7e2f4] bg-white p-7 shadow-xl sm:p-10">
      <BrandLogo iconSize={28} />
      <p className="mt-7 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Simulação local da Kiwify · nenhum pagamento será cobrado</p>
      <h1 className="mt-6 text-3xl font-bold">Revisar compra de teste</h1>
      {order ? <>
        <p className="mt-3 text-slate-600">{order.credits === 1 ? '1 Mandalart completo' : '3 Mandalarts completos'}</p>
        <strong className="mt-5 block text-4xl">{formatBRL(order.amount)}</strong>
        <fieldset className="mt-7 space-y-3"><legend className="mb-3 font-semibold">Forma de pagamento simulada</legend>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4"><input type="radio" name="method" checked={method === 'pix'} onChange={() => setMethod('pix')} /> Pix</label>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4"><input type="radio" name="method" checked={method === 'card'} onChange={() => setMethod('card')} /> Cartão de crédito</label>
        </fieldset>
        <label className="mt-6 block font-semibold">E-mail para acesso<input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@exemplo.com" autoComplete="email" /></label>
        <p className="mt-3 text-xs leading-5 text-slate-500">O envio de e-mail é simulado no ambiente local. Use um endereço de teste.</p>
        {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
        <button type="button" className="brand-button mt-7 w-full rounded-xl px-5 py-4 text-center font-bold text-white" disabled={busy || order.status !== 'pending' || !email.trim()} onClick={complete}>{busy ? 'Concluindo simulação…' : 'Simular compra aprovada'}</button>
        {order.status !== 'pending' && <p className="mt-4 text-sm">Este pedido de teste já foi concluído.</p>}
      </> : <p className="mt-6 text-slate-600">{error || 'Carregando pedido de teste…'}</p>}
      <Link href="/comecar?kiwify" className="mt-6 block text-center text-sm font-semibold text-[#5134be]">Voltar à prévia</Link>
    </div>
  </main>
}
