'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { requestDreamRefund } from '@/actions/refunds'
import { formatBRL } from '@/lib/dream-packs'

type Order = { id: string; amount: number; credits: number; createdAt: string }

export function RefundOptions({ orders }: { orders: Order[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [completed, setCompleted] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  if (orders.length === 0)
    return <p className="rounded-2xl border border-violet-100 bg-white p-6 text-sm leading-7 text-slate-600">Não há uma compra Stripe dos últimos 7 dias disponível para reembolso nesta conta. Se precisar de ajuda com outra compra, confira seu histórico em “Seus sonhos”.</p>

  return (
    <div className="grid gap-4">
      {orders.map((order) => {
        const done = completed.includes(order.id)
        return (
          <article key={order.id} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_8px_28px_rgba(50,40,110,.05)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="ph-mask text-xs font-bold uppercase tracking-widest text-violet-600">Compra de {order.credits} {order.credits === 1 ? 'sonho' : 'sonhos'}</p>
                <h2 className="ph-mask mt-2 text-xl font-bold text-slate-900">{formatBRL(order.amount)}</h2>
                <p className="ph-mask mt-1 text-sm text-slate-500">{new Date(order.createdAt).toLocaleDateString('pt-BR')}</p>
              </div>
              {done ? <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><Check size={15} /> Reembolso solicitado</span> : (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => { setError(null); setConfirming(order.id) }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-200 px-4 py-2 text-sm font-bold text-violet-700 hover:bg-violet-50 disabled:opacity-60"
                >
                  Solicitar reembolso
                </button>
              )}
            </div>
            {confirming === order.id && !done && (
              <div className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-sm leading-6 text-slate-700">Confirma o reembolso de <strong className="ph-mask">{formatBRL(order.amount)}</strong>? Os créditos desta compra serão cancelados após a confirmação. Seus planos já salvos continuam acessíveis.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={busy !== null} onClick={() => setConfirming(null)} className="min-h-10 rounded-lg border border-violet-200 bg-white px-4 text-sm font-semibold text-violet-700 disabled:opacity-60">Manter minha compra</button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={async () => {
                      setBusy(order.id)
                      setError(null)
                      try {
                        await requestDreamRefund(order.id)
                        setCompleted((current) => [...current, order.id])
                        setConfirming(null)
                      } catch (caught) {
                        setError(caught instanceof Error ? caught.message : 'Não foi possível solicitar o reembolso agora. Tente novamente.')
                      } finally {
                        setBusy(null)
                      }
                    }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                  >
                    {busy === order.id && <Loader2 size={16} className="animate-spin" />}
                    Confirmar reembolso
                  </button>
                </div>
              </div>
            )}
            {done && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-emerald-800" role="status">Reembolso iniciado pelo Stripe no mesmo meio de pagamento. Seu saldo será atualizado após a confirmação.</p>}
          </article>
        )
      })}
      {error && <p role="alert" className="ph-mask rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    </div>
  )
}
