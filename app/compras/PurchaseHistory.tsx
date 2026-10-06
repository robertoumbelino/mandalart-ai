'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CreditCard, Loader2, RotateCcw } from 'lucide-react'
import { PixMark } from '@/app/components/PixMark'
import { getPurchaseHistory, requestDreamRefund } from '@/actions/refunds'
import { formatBRL } from '@/lib/dream-packs'
import { SUPPORT_EMAIL, getSupportHref } from '@/lib/support'

type Purchase = NonNullable<Awaited<ReturnType<typeof getPurchaseHistory>>>[number]
const supportHref = getSupportHref('Ajuda com uma compra no Mandalart')

function purchaseDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Sao_Paulo' }).replace('.', '')
}

function paymentMethod(purchase: Purchase) {
  if (purchase.method === 'PIX') return <><span className="purchase-method-icon purchase-method-icon--pix"><PixMark size={18} /></span> Pix</>
  if (purchase.method === 'CREDIT_CARD') return <><span className="purchase-method-icon"><CreditCard size={18} /></span> Cartão de crédito</>
  return purchase.provider === 'asaas' ? 'Pagamento pelo Asaas' : `Pagamento pela ${purchase.provider === 'stripe' ? 'Stripe' : purchase.provider === 'kiwify' ? 'Kiwify' : 'plataforma'}`
}

function purchaseState(purchase: Purchase, requested: boolean) {
  if (purchase.status === 'disputed') return { label: 'Em análise', tone: 'warning', note: 'Este pagamento está em análise.' }
  if (purchase.status === 'refunded') return purchase.refunded < purchase.amount
    ? { label: 'Estorno parcial', tone: 'neutral', note: `${formatBRL(purchase.refunded)} devolvidos ao meio de pagamento original.` }
    : { label: 'Estornado', tone: 'neutral', note: 'Valor devolvido ao meio de pagamento original.' }
  if (requested) return { label: 'Em processamento', tone: 'warning', note: 'Aguardando a confirmação do reembolso.' }
  if (purchase.canRefund) return { label: 'Pago', tone: 'paid', note: `Reembolso disponível até ${purchaseDate(purchase.guaranteeEndsAt!)}.` }
  if (purchase.withinGuarantee) return { label: 'Pago', tone: 'paid', note: 'Precisa solicitar reembolso? Fale com o suporte.' }
  return { label: 'Pago', tone: 'neutral', note: 'Prazo de reembolso encerrado.' }
}

export function PurchaseHistory({ purchases }: { purchases: Purchase[] }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [requested, setRequested] = useState<string[]>([])
  const [error, setError] = useState<{ id: string; message: string } | null>(null)

  return <section aria-label="Histórico de compras" className="purchase-list">
    {purchases.map((purchase) => {
      const refundRequested = purchase.refundRequested || requested.includes(purchase.id)
      const state = purchaseState(purchase, refundRequested)
      const canRefund = purchase.canRefund && !refundRequested
      return <article key={purchase.id} className="purchase-card">
        <div className="purchase-card-row">
          <div className="purchase-card-date"><strong>{purchaseDate(purchase.paidAt || purchase.createdAt)}</strong><span>Compra realizada</span></div>
          <div className="purchase-card-product"><strong>{purchase.credits === 1 ? 'Mandalart completo' : `${purchase.credits} Mandalarts completos`}</strong><span>{paymentMethod(purchase)}</span></div>
          <strong className="purchase-card-amount">{formatBRL(purchase.amount)}</strong>
          <div className="purchase-card-state"><span className={`purchase-status purchase-status--${state.tone}`}>{state.tone === 'paid' ? <Check size={16} /> : state.label === 'Estornado' ? <RotateCcw size={16} /> : null}{state.label}</span><small>{state.note}</small></div>
          <div className="purchase-card-action">{canRefund ? <button type="button" disabled={busy !== null} onClick={() => { setError(null); setConfirming(purchase.id) }}>Solicitar reembolso</button> : !refundRequested && purchase.status === 'paid' && <a href={supportHref}>Precisa de ajuda? <span aria-hidden="true">→</span></a>}</div>
        </div>

        {confirming === purchase.id && canRefund && <div className="purchase-confirm">
          <strong>Confirmar reembolso de {formatBRL(purchase.amount)}?</strong>
          <p>Ao confirmar, solicitaremos agora o estorno no mesmo meio de pagamento. Os créditos desta compra serão removidos após a confirmação; seus planos já salvos continuam acessíveis.</p>
          <div><button type="button" className="purchase-cancel" disabled={busy !== null} onClick={() => setConfirming(null)}>Manter compra</button><button type="button" className="brand-button purchase-confirm-button" disabled={busy !== null} onClick={async () => {
            setBusy(purchase.id)
            setError(null)
            try {
              await requestDreamRefund(purchase.id)
              setRequested(current => [...current, purchase.id])
              setConfirming(null)
              router.refresh()
            } catch (caught) {
              setError({ id: purchase.id, message: caught instanceof Error ? caught.message : 'Não foi possível solicitar o reembolso agora.' })
            } finally {
              setBusy(null)
            }
          }}>{busy === purchase.id && <Loader2 size={16} className="animate-spin" />}{busy === purchase.id ? 'Solicitando…' : 'Confirmar reembolso'}</button></div>
        </div>}
        {error?.id === purchase.id && <p className="purchase-error" role="alert">{error.message} Se precisar, escreva para <a href={supportHref}>{SUPPORT_EMAIL}</a>.</p>}
      </article>
    })}
    <p className="purchase-footnote"><span />Compras feitas com sua conta Mandalart.<span /></p>
  </section>
}
