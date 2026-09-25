'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  Loader2,
  ShieldCheck,
  Sparkles,
  Sprout,
} from 'lucide-react'
import { BrandLogo } from '@/app/components/Brand'
import { Auth } from '@/app/components/Auth'
import { getCurrentUser } from '@/actions/auth'
import { getDreamWallet } from '@/actions/dreams'
import {
  checkDreamPayment,
  getPaymentOptions,
  startDreamCheckout,
} from '@/actions/payments'
import {
  checkOnboardingPayment,
  getOnboardingPaymentOptions,
  startOnboardingCheckout,
} from '@/actions/onboarding-checkout'
import { DREAM_PACKS, type DreamPack } from '@/lib/dream-packs'
import type { User } from '@/types'

type Wallet = Awaited<ReturnType<typeof getDreamWallet>>
const KIWIFY_ORDER_KEY = 'mandalart_kiwify_order'
const transactionLabels: Record<string, string> = {
  purchase: 'Sonhos recebidos',
  payment_reversed: 'Ajuste por reembolso ou contestação',
  generation_reserved: 'Criação de planner',
  generation_failed: 'Sonho devolvido',
  generation_expired: 'Sonho devolvido após interrupção',
}

export function DreamShop() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [options, setOptions] = useState<Awaited<
    ReturnType<typeof getPaymentOptions>
  > | null>(null)
  const [pack, setPack] = useState<DreamPack>(1)
  const [source, setSource] = useState<'comecar' | 'account'>('account')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [kiwifyOrderId, setKiwifyOrderId] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<{ id: string; pack: DreamPack } | null>(null)

  useEffect(() => {
    let active = true
    const params = new URLSearchParams(window.location.search)
    const fromOnboarding = params.get('origem') === 'comecar'
    Promise.all([
      getCurrentUser(),
      fromOnboarding ? getOnboardingPaymentOptions() : getPaymentOptions(),
    ])
      .then(([current, config]) => {
        if (active) {
          setPack(params.get('pacote') === '3' ? 3 : 1)
          setSource(params.get('origem') === 'comecar' ? 'comecar' : 'account')
          setSessionId(params.get('session_id'))
          if (fromOnboarding && !params.has('session_id')) {
            try {
              setKiwifyOrderId(sessionStorage.getItem(KIWIFY_ORDER_KEY))
            } catch {
              // O saldo continua disponível mesmo sem armazenamento no navegador.
            }
          }
          setCancelled(params.has('cancelado'))
          setUser(current)
          setOptions(config)
        }
      })
      .catch(() => {
        if (active)
          setError('Não foi possível carregar sua conta. Atualize a página.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    let timer: ReturnType<typeof setTimeout>
    let attempts = 0
    async function sync() {
      try {
        if (sessionId) {
          const payment = await checkDreamPayment(sessionId)
          if (!active) return
          setPaymentStatus(payment?.status || 'pending')
          if (payment?.source === 'comecar') setSource('comecar')
          if (payment?.status === 'pending' && ++attempts < 40)
            timer = setTimeout(sync, 3000)
        } else if (kiwifyOrderId) {
          const payment = await checkOnboardingPayment(kiwifyOrderId)
          if (!active) return
          setPaymentStatus(payment.status)
          if (payment.status === 'pending' && ++attempts < 40)
            timer = setTimeout(sync, 3000)
        }
        const current = await getDreamWallet()
        if (active) {
          setWallet(current)
          setError(null)
        }
      } catch {
        if (active)
          setError(
            'Não conseguimos atualizar agora. Seu pagamento será conferido com segurança ao recarregar esta página.',
          )
      }
    }
    void sync()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [user, sessionId, kiwifyOrderId])

  async function buy() {
    if (busy) return
    setBusy(true)
    setError(null)
    request.current =
      request.current?.pack === pack
        ? request.current
        : { id: crypto.randomUUID(), pack }
    try {
      const checkout =
        source === 'comecar'
          ? await startOnboardingCheckout(pack, request.current.id)
          : await startDreamCheckout(pack, request.current.id)
      if (source === 'comecar' && options?.provider === 'kiwify') {
        try {
          sessionStorage.setItem(KIWIFY_ORDER_KEY, request.current.id)
        } catch {
          // O webhook associa a compra à conta; o retorno só perde a consulta rápida.
        }
      }
      window.location.assign(checkout.url)
    } catch {
      request.current = null
      setError(
        'Não conseguimos abrir o checkout. Nenhum sonho foi descontado. Tente novamente em instantes.',
      )
      setBusy(false)
    }
  }

  if (loading)
    return (
      <main className="dream-shop shop-loading">
        <Loader2 className="animate-spin" aria-label="Carregando sua conta" />
      </main>
    )
  if (!user)
    return (
      <>
        <div className="shop-auth-note">
          <Link href={source === 'comecar' ? '/comecar' : '/'}>
            <ArrowLeft size={16} /> Voltar
          </Link>
          <p>
            Entre ou crie sua conta para guardar seus sonhos.
            {source === 'comecar' &&
              ' Sua prévia continua salva neste navegador.'}
          </p>
        </div>
        <Auth
          onLogin={async (current) => {
            setUser(current)
          }}
        />
      </>
    )

  const success = paymentStatus === 'paid'
  const balance = Math.max(0, wallet?.balance || 0)
  const hasPayment = Boolean(sessionId || kiwifyOrderId)
  const showShop = !hasPayment || ['refunded', 'disputed', 'expired', 'failed'].includes(paymentStatus || '')
  return (
    <main className="dream-shop">
      <header className="shop-header">
        <Link href="/" aria-label="Mandalart.AI, início">
          <BrandLogo iconSize={28} />
        </Link>
        <Link
          className="shop-back"
          href={source === 'comecar' ? '/comecar' : '/'}
        >
          <ArrowLeft size={16} /> Voltar
        </Link>
      </header>
      <div className="shop-content">
        {error && (
          <p className="shop-message shop-error" role="alert">
            {error}
          </p>
        )}
        {cancelled && (
          <p className="shop-message" role="status">
            Você voltou sem concluir a compra. Pode escolher seu pacote quando
            quiser.
          </p>
        )}
        {hasPayment && (
          <section className="shop-payment" aria-live="polite">
            <span className="shop-symbol">
              {success ? <Check size={28} /> : <CreditCard size={28} />}
            </span>
            <h1>
              {success
                ? 'Pagamento concluído!'
                : paymentStatus === 'refunded'
                  ? 'Reembolso registrado.'
                  : paymentStatus === 'disputed'
                    ? 'Pagamento em análise.'
                    : paymentStatus === 'expired'
                      ? 'Este checkout expirou.'
                      : paymentStatus === 'failed'
                        ? 'Pagamento não concluído.'
                        : 'Conferindo seu pagamento.'}
            </h1>
            <p>
              {success
                ? 'Seus sonhos foram adicionados à sua conta. Agora você pode transformar seu objetivo em um plano possível.'
                : paymentStatus === 'pending' || !paymentStatus
                  ? `Os créditos aparecem assim que ${kiwifyOrderId ? 'a Kiwify' : 'o Stripe'} confirma o pagamento. Você pode voltar depois; eles ficam na sua conta.`
                  : 'O saldo abaixo já considera a situação desta compra.'}
            </p>
            {success && (
              <Link
                className="brand-button shop-cta"
                href={source === 'comecar' ? '/?continuar=sonho' : '/'}
              >
                {source === 'comecar' ? 'Continuar meu sonho' : 'Começar meu sonho'} <ArrowRight size={18} />
              </Link>
            )}
            {success && (
              <a className="shop-more-link" href={`/sonhos?origem=${source}`}>
                Comprar mais sonhos
              </a>
            )}
            {kiwifyOrderId && !success && paymentStatus === 'pending' && (
              <button
                className="shop-more-link"
                onClick={() => {
                  try {
                    sessionStorage.removeItem(KIWIFY_ORDER_KEY)
                  } catch {
                    // O pedido continua associado à conta.
                  }
                  setKiwifyOrderId(null)
                  setPaymentStatus(null)
                }}
              >
                Voltar aos pacotes
              </button>
            )}
          </section>
        )}
        {showShop && (
          <>
            <section className="shop-intro">
              <span className="shop-eyebrow">
                UM PASSO NA DIREÇÃO DO QUE IMPORTA
              </span>
              {!hasPayment && (
                <h1>
                  Seus sonhos merecem
                  <br />
                  <span className="brand-text">um plano para acontecer.</span>
                </h1>
              )}
              <p>
                Um sonho, um planner completo. Você escolhe o momento de começar.
              </p>
            </section>
            <section className="shop-wallet" aria-label="Seu saldo">
              <span className="shop-symbol">
                <Sprout size={25} />
              </span>
              <div>
                <span>Na sua conta</span>
                <strong>
                  {wallet
                    ? `${balance} ${balance === 1 ? 'sonho disponível' : 'sonhos disponíveis'}`
                    : 'Carregando saldo…'}
                </strong>
              </div>
              {balance > 0 && (
                <Link href={source === 'comecar' ? '/?continuar=sonho' : '/'}>
                  Usar <ArrowRight size={16} />
                </Link>
              )}
            </section>
            {wallet && wallet.balance < 0 && (
              <p className="shop-message">
                Um pagamento de sonhos já utilizados foi estornado ou contestado. Os
                próximos créditos primeiro compensam esse saldo ({wallet.balance}).
                Seus planners salvos continuam acessíveis.
              </p>
            )}
            <fieldset className="shop-packs" disabled={busy}>
              <legend>Escolha o espaço para os seus próximos sonhos</legend>
              {([1, 3] as const).map((value) => (
                <label
                  key={value}
                  className={`shop-pack ${pack === value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="dream-pack"
                    checked={pack === value}
                    onChange={() => setPack(value)}
                  />
                  <div className="shop-pack-top">
                    <span className="shop-radio">
                      {pack === value && <Check size={13} />}
                    </span>
                    <span>{DREAM_PACKS[value].label}</span>
                    {value === 3 && <small>Economize R$ 19,80</small>}
                  </div>
                  <strong className="shop-price">{DREAM_PACKS[value].price}</strong>
                  <span className="shop-pack-description">
                    {value === 1
                      ? 'Para o objetivo que está no seu coração agora.'
                      : 'Seu objetivo de agora e mais dois novos começos.'}
                  </span>
                  <span className="shop-per-dream">
                    {value === 3
                      ? 'R$ 33,30 por sonho'
                      : 'Um planner completo, feito para você'}
                  </span>
                </label>
              ))}
            </fieldset>
            <section className="shop-included">
              <h2>Cada sonho vira um caminho claro.</h2>
              <ul>
                <li>
                  <Check size={17} /> 8 pilares que organizam seu objetivo
                </li>
                <li>
                  <Check size={17} /> 64 ações com 192 próximos passos
                </li>
                <li>
                  <Check size={17} /> Seu progresso salvo, para continuar no seu
                  ritmo
                </li>
              </ul>
            </section>
            <div className="shop-purchase">
              <button
                className="brand-button shop-cta"
                disabled={busy || !options?.available}
                onClick={buy}
              >
                {busy ? (
                  <>
                    <Loader2 size={19} className="animate-spin" /> Abrindo checkout…
                  </>
                ) : (
                  <>
                    Escolher {DREAM_PACKS[pack].label}{' '}
                    · {DREAM_PACKS[pack].price} <ArrowRight size={18} />
                  </>
                )}
              </button>
              <p>
                <ShieldCheck size={15} /> Checkout seguro pela{' '}
                {options?.provider === 'kiwify' ? 'Kiwify' : 'Stripe'}
                {options?.provider !== 'kiwify' &&
                  ` · ${options?.pix ? 'Cartão de crédito e Pix' : 'Cartão de crédito'}`}
              </p>
              <small>
                Pagamento único. Sem assinatura. Cada novo planner usa 1 sonho.
                <br />
                Consultar e atualizar seus planners não gasta créditos.
              </small>
              {!options?.available && (
                <p role="status">
                  Estamos preparando as compras. Volte em breve para começar seu sonho.
                </p>
              )}
            </div>
            <details className="shop-faq">
              <summary>E se o planner não for gerado?</summary>
              <p>
                Seu sonho fica reservado durante a criação. Se ela falhar, o crédito
                volta automaticamente. Se a conexão cair, confira seus planners: uma
                geração concluída fica salva e não é cobrada novamente.
              </p>
            </details>
            {wallet && wallet.transactions.length > 0 && (
              <details className="shop-history">
                <summary>Movimentações dos seus sonhos</summary>
                <ul>
                  {wallet.transactions.map((entry, index) => (
                    <li key={`${entry.date}-${index}`}>
                      <span>
                        {transactionLabels[entry.reason] || 'Ajuste de saldo'}
                        <small>
                          {new Date(entry.date).toLocaleString('pt-BR')}
                        </small>
                      </span>
                      <strong className={entry.delta > 0 ? 'brand-text' : ''}>
                        {entry.delta > 0 ? '+' : ''}
                        {entry.delta}
                      </strong>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
        <footer className="shop-footer">
          <Sparkles size={15} /> Um sonho seu. Infinitas possibilidades.
        </footer>
      </div>
    </main>
  )
}
