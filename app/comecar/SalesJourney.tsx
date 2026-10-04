'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { track } from '@vercel/analytics'
import { sendGoogleAnalyticsEvent } from '@/app/components/GoogleAnalytics'
import { ArrowLeft, ArrowRight, Check, LoaderCircle, RotateCcw, ShieldCheck, Sparkles, Timer } from 'lucide-react'
import { BrandLogo } from '@/app/components/Brand'
import { ChecklistItem } from '@/app/components/ChecklistItem'
import { DreamIcon } from './Visuals'
import { PlanFeaturePreview } from './PlanFeaturePreview'
import { CATEGORIES, getDream, HORIZONS, OBSTACLES } from '@/lib/onboarding'
import { captureProductEvent, getProductDistinctId } from '@/lib/posthog'
import { captureAttribution } from '@/lib/attribution'
import { trackMetaEvent } from '@/lib/meta-events'
import { MARKETING_CONSENT_KEY } from '@/lib/marketing-consent'
import { purchasedPreview } from '@/lib/onboarding-storage'
import { getOnboardingPaymentOptions } from '@/actions/onboarding-checkout'
import { startSalesCheckout } from '@/actions/sales-checkout'
import { OBSTACLE_PROMISES, restoreSalesDraft, SALES_DRAFT_KEY, SALES_FIELDS, SALES_JOURNEY_VERSION, salesAnswersSchema, salesStepComplete, salesTitle, type SalesDraft, type SalesDraftAnswers } from '@/lib/sales-journey'
import './sales.css'

const LegacyOnboarding = dynamic(() => import('./Onboarding').then(module => module.Onboarding))
const EMPTY: SalesDraft = { version: 3, attemptId: '00000000-0000-4000-8000-000000000000', savedAt: 0, screen: 'questions', question: 0, answers: { journeyVersion: SALES_JOURNEY_VERSION }, intentId: null }
const COPY = [
  { eyebrow: 'UM ESPAÇO PARA O QUE IMPORTA', title: 'Qual área importa mais agora?', description: 'Escolha a área do objetivo que você quer tirar do papel.' },
  { eyebrow: 'VAMOS DAR UM NOME A ESSE SONHO', title: 'O que você gostaria de realizar?', description: 'Escolha o sonho que mais combina com o seu momento.' },
  { eyebrow: 'UM POUCO MAIS DE CLAREZA', title: 'O que torna o próximo passo mais difícil?', description: 'Escolha o que mais pesa hoje. Vamos levar isso em conta.' },
  { eyebrow: 'O SEU TEMPO, O SEU CAMINHO', title: 'Quando você quer ver os primeiros avanços?', description: 'Esse período orienta o começo. Não é uma cobrança para realizar tudo.' },
]
const STACK = [
  ['Seu objetivo virado em plano', 'Ajustado à sua realidade: prazo, rotina e limites.', 'goal'],
  ['Sua mandala', 'Os 8 pilares do seu objetivo em uma imagem, para salvar.', 'mandala'],
  ['A rota completa', '64 etapas na ordem certa, do primeiro passo à conquista.', 'route'],
  ['64 tarefas pequenas', 'Cada uma com “como fazer” e checklist.', 'task'],
  ['Dica de Ouro em cada tarefa', 'O atalho de quem já passou por isso.', 'advice'],
  ['Seu foco agora', 'Abriu o celular, sabe o que fazer hoje. Parou, continua de onde parou.', 'focus'],
] as const
function marketingConsent() {
  try { return localStorage.getItem(MARKETING_CONSENT_KEY) === 'accepted' } catch { return false }
}
const EXAMPLE_CHECKLIST = ['Pesquise provas de 21,1 km.', 'Anote a data e o local de cada opção.', 'Registre o link da página oficial.']

export function SalesJourney() {
  const [draft, setDraft] = useState<SalesDraft>(EMPTY)
  const [hydrated, setHydrated] = useState(false)
  const [legacy, setLegacy] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [directPix, setDirectPix] = useState(false)
  const [kiwify, setKiwify] = useState(false)
  const [method, setMethod] = useState<'pix' | 'card'>('pix')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [offerVisible, setOfferVisible] = useState(false)
  const [checked, setChecked] = useState([false, false, false])
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const busyRef = useRef(false)
  const sectionEvents = useRef(new Set<string>())
  const screenStartedAt = useRef(0)
  const seenScreen = useRef('')

  const analytics = useCallback((name: string, properties: Record<string, string | number> = {}, attemptId?: string) => {
    const enriched = { ...captureAttribution(), entry_source: new URLSearchParams(window.location.search).has('kiwify') ? 'kiwify' : 'direct', ...properties, journey_version: SALES_JOURNEY_VERSION, journey_attempt_id: attemptId || draft.attemptId }
    void fetch('/api/onboarding/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, properties: enriched }), keepalive: true }).catch(() => {})
    // Keep the historical funnel usable across the change.
    const alias = name === 'quiz_complete' ? 'quiz_completed' : name === 'checkout_redirect' ? 'checkout_started' : name === 'payment_error' ? 'checkout_error' : null
    for (const eventName of alias ? [name, alias] : [name]) {
      captureProductEvent(eventName, enriched)
      try { track(eventName, enriched) } catch { /* Analytics must not interrupt the journey. */ }
      try { sendGoogleAnalyticsEvent(eventName, enriched) } catch { /* Analytics must not interrupt the journey. */ }
    }
  }, [draft.attemptId])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (new URLSearchParams(window.location.search).has('retomar')) { setLegacy(true); setHydrated(true); return }
      const useKiwify = new URLSearchParams(window.location.search).has('kiwify')
      setKiwify(useKiwify)
      let restored: SalesDraft | null = null
      try {
        restored = restoreSalesDraft(JSON.parse(localStorage.getItem(SALES_DRAFT_KEY) || 'null'))
        if (purchasedPreview(restored?.intentId || undefined)) { localStorage.removeItem(SALES_DRAFT_KEY); restored = null }
      } catch { setStorageAvailable(false) }
      const initial = restored || { ...EMPTY, attemptId: crypto.randomUUID(), savedAt: Date.now() }
      setDraft(initial)
      window.history.replaceState({ ...window.history.state, salesJourney: { screen: initial.screen, question: initial.question } }, '')
      setHydrated(true)
      analytics('landing_view', { entry_version: 'four-questions-v1', entry_visible: Number(initial.screen === 'questions' && initial.question === 0) }, initial.attemptId)
      void getOnboardingPaymentOptions(useKiwify).then(options => { setDirectPix(options.directPix); if (!options.directPix) setMethod('card') }).catch(() => {})
    })
    const resetBusy = () => { busyRef.current = false; setBusy(false) }
    const onPop = (event: PopStateEvent) => {
      if (advanceRef.current) clearTimeout(advanceRef.current)
      busyRef.current = false
      setBusy(false)
      setError('')
      const state = event.state?.salesJourney
      setDraft(current => {
        const missing = SALES_FIELDS.findIndex((_, step) => !salesStepComplete(current.answers, step))
        const question = Math.max(0, Math.min(Number(state?.question) || 0, missing < 0 ? 3 : missing))
        const screen = missing < 0 && ['closing', 'checkout'].includes(state?.screen) ? state.screen as 'closing' | 'checkout' : 'questions'
        return { ...current, question, screen }
      })
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('pageshow', resetBusy)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('popstate', onPop); window.removeEventListener('pageshow', resetBusy); if (advanceRef.current) clearTimeout(advanceRef.current) }
    // Initialization captures the entry once with the restored attempt ID.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navigate = useCallback((screen: SalesDraft['screen'], question = 3, replace = false) => {
    setDraft(current => ({ ...current, screen, question }))
    setError('')
    window.history[replace ? 'replaceState' : 'pushState']({ ...window.history.state, salesJourney: { screen, question } }, '')
  }, [])

  useEffect(() => {
    if (!hydrated || legacy) return
    try { localStorage.setItem(SALES_DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() })) } catch { queueMicrotask(() => setStorageAvailable(false)) }
  }, [draft, hydrated, legacy])

  useEffect(() => {
    if (!hydrated || legacy) return
    const screen = draft.screen === 'questions' ? `question_${SALES_FIELDS[draft.question]}` : draft.screen
    if (seenScreen.current === screen) return
    seenScreen.current = screen
    screenStartedAt.current = performance.now()
    analytics('screen_view', { screen, step: draft.screen === 'questions' ? draft.question + 1 : 0 })
    const frame = requestAnimationFrame(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector<HTMLElement>('[data-step-heading]')?.focus({ preventScroll: true }) })
    return () => cancelAnimationFrame(frame)
  }, [draft.screen, draft.question, hydrated, legacy, analytics])

  useEffect(() => {
    if (draft.screen !== 'processing') return
    const timer = setTimeout(() => navigate('closing', 3, true), 3000)
    return () => clearTimeout(timer)
  }, [draft.screen, navigate])

  useEffect(() => {
    if (!hydrated || draft.screen !== 'closing') return
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const name = (entry.target as HTMLElement).dataset.salesEvent!
        if (name === 'offer_view') setOfferVisible(entry.isIntersecting)
        if (!entry.isIntersecting) continue
        const key = `${draft.attemptId}:${name}`
        if (!sectionEvents.current.has(key)) { sectionEvents.current.add(key); analytics(name) }
      }
    }, { threshold: 0.15 })
    document.querySelectorAll('[data-sales-event]').forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [draft.screen, draft.attemptId, hydrated, analytics])

  function advance(answers: SalesDraftAnswers) {
    if (!salesStepComplete(answers, draft.question)) return
    const field = SALES_FIELDS[draft.question]
    // eslint-disable-next-line react-hooks/purity -- elapsed time is read only after an answer
    analytics('quiz_question', { question: draft.question + 1, question_key: field, duration_ms: Math.round(performance.now() - screenStartedAt.current) })
    if (draft.question === 0) analytics('quiz_started')
    if (draft.question === 3) { analytics('quiz_complete'); navigate('processing') }
    else navigate('questions', draft.question + 1)
  }
  function select(value: string) {
    if (advanceRef.current) clearTimeout(advanceRef.current)
    const field = SALES_FIELDS[draft.question]
    const answers = { ...draft.answers, [field]: value }
    if (field === 'category' && draft.answers.category !== value) { delete answers.dream; delete answers.customDream }
    if (field === 'dream' && value !== 'other') delete answers.customDream
    setDraft(current => ({ ...current, answers, intentId: null }))
    setError('')
    if (field === 'dream' && value === 'other') requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('#sales-custom-dream')?.focus())
    else advanceRef.current = setTimeout(() => advance(answers), 180)
  }
  function beginCheckout(location: string) {
    analytics('checkout_click', { cta_location: location, value: 37 })
    navigate('checkout')
    analytics('checkout_view', { provider: kiwify ? 'kiwify' : 'default', checkout_stage: 'payment_selection' })
  }
  function restartFromBeginning() {
    if (advanceRef.current) clearTimeout(advanceRef.current)
    busyRef.current = false
    sectionEvents.current.clear()
    seenScreen.current = ''
    setBusy(false)
    setEmail('')
    setError('')
    setChecked([false, false, false])
    setOfferVisible(false)
    const initial = { ...EMPTY, attemptId: crypto.randomUUID(), savedAt: Date.now() }
    setDraft(initial)
    try { localStorage.setItem(SALES_DRAFT_KEY, JSON.stringify(initial)) } catch { setStorageAvailable(false) }
    window.history.replaceState({ ...window.history.state, salesJourney: { screen: 'questions', question: 0 } }, '')
    analytics('landing_view', { entry_version: 'four-questions-v1', entry_visible: 1 }, initial.attemptId)
  }
  async function checkout(event: React.FormEvent) {
    event.preventDefault()
    if (busyRef.current) return
    const parsed = salesAnswersSchema.safeParse(draft.answers)
    if (!parsed.success) { navigate('questions', 0); return }
    busyRef.current = true
    setBusy(true)
    setError('')
    const orderId = crypto.randomUUID()
    try {
      const result = await startSalesCheckout({ answers: parsed.data, attemptId: draft.attemptId, orderId, method: kiwify ? 'kiwify' : directPix ? method : 'card', ...(directPix && method === 'pix' && !kiwify ? { email: email.trim() } : {}), attribution: captureAttribution(), analyticsDistinctId: getProductDistinctId(), marketingConsent: marketingConsent() })
      setDraft(current => ({ ...current, intentId: result.intentId }))
      try {
        localStorage.setItem(SALES_DRAFT_KEY, JSON.stringify({ ...draft, intentId: result.intentId, savedAt: Date.now() }))
        if (kiwify) { sessionStorage.setItem('mandalart_kiwify_guest_order', orderId); localStorage.setItem('mandalart_kiwify_guest_order', orderId) }
      } catch {}
      analytics('checkout_redirect', { order_id: orderId, method: kiwify ? 'kiwify' : directPix ? method : 'card' })
      if (!kiwify && (!directPix || method === 'card')) analytics('card_redirect', { order_id: orderId })
      trackMetaEvent({ name: 'InitiateCheckout', data: { value: 37, currency: 'BRL' }, onceKey: `checkout.${orderId}`, eventId: `checkout-${orderId}` })
      window.location.assign(result.url)
    } catch (cause) {
      analytics('payment_error', { method: kiwify ? 'kiwify' : method, stage: 'create_checkout' })
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o pagamento. Tente novamente.')
      busyRef.current = false
      setBusy(false)
    }
  }

  if (legacy) return <LegacyOnboarding />
  const category = CATEGORIES.find(item => item.id === draft.answers.category)
  const copy = COPY[draft.question]
  const choices = draft.question === 0 ? CATEGORIES : draft.question === 1
    ? [...(category?.dreams || []).map(title => ({ id: title, title, icon: category?.icon })), { id: 'other', title: 'Meu sonho é outro', icon: 'idea' }]
    : draft.question === 2 ? OBSTACLES : HORIZONS
  const title = salesTitle(draft.answers)
  const titleGoalIndex = title.indexOf(' para ')
  const offerPeriod = { month: 'em 30 dias', quarter: 'em 3 meses', semester: 'em 6 meses', open: '' }[draft.answers.horizon || 'open']
  const entry = draft.screen === 'questions' && draft.question === 0
  const cta = (location: string) => <button type="button" className="begin-primary sales-cta" onClick={() => beginCheckout(location)}>Quero meu plano · R$ 37 <ArrowRight size={19} /></button>
  return <div className={`begin-shell sales-shell ${entry ? 'has-welcome' : ''}`}>
    <a href="#begin-main" className="begin-skip">Pular para o conteúdo</a>
    <header className="begin-header"><Link href="/" aria-label="Mandalart, início"><BrandLogo iconSize={29} /></Link><span className="header-assurance"><span className="live-dot" /> No seu ritmo.</span></header>
    {!storageAvailable && <p className="storage-notice" role="status">Seu navegador não permitiu salvar suas respostas. Mantenha esta página aberta para continuar.</p>}
    {draft.screen === 'questions' && <main id="begin-main" className={entry ? 'entry-page begin-enter' : 'questions-page sales-questions'}>
      {entry ? <div className="entry-layout">
        <header className="entry-copy"><span className="begin-eyebrow">DO OBJETIVO AO PRÓXIMO PASSO</span><h1 data-step-heading tabIndex={-1}>Tire seu objetivo <em>do papel.</em></h1><p>Transforme o que você quer realizar em um plano com etapas, tarefas e progresso salvo.</p><span className="entry-duration">4 perguntas · sem cadastro · plano completo por R$ 37</span></header>
        <section className="entry-selection" aria-labelledby="entry-question-title"><div className="entry-question-heading"><h2 id="entry-question-title">{copy.title}</h2><span className="entry-step">1 de 4</span></div><fieldset className="entry-categories"><legend className="sr-only">{copy.title}</legend>{CATEGORIES.map(item => <label key={item.id} className={`entry-choice tone-${item.id} ${draft.answers.category === item.id ? 'selected' : ''}`}><input type="radio" name="category" checked={draft.answers.category === item.id} value={item.id} onChange={() => select(item.id)} onClick={() => { if (draft.answers.category === item.id) select(item.id) }} disabled={!hydrated} /><span className="entry-choice-icon"><DreamIcon name={item.icon} size={23} /></span><span className="entry-choice-text"><strong>{item.title}</strong><small>{item.hint}</small></span><ArrowRight size={15} /></label>)}</fieldset><p className="entry-next">Escolha uma área para começar.</p></section>
      </div> : <>
        <aside className="question-aside sales-question-aside"><Sparkles size={38} /><span className="begin-eyebrow">UM SONHO, UM PRÓXIMO PASSO</span><p className="aside-quote">Um plano começa com o que importa para você.</p><div className="aside-dream">{getDream(draft.answers) || category?.title}</div></aside>
        <div className="question-panel"><div className="question-navigation"><button className="back-button" type="button" onClick={() => navigate('questions', draft.question - 1)}><ArrowLeft size={16} /> Voltar</button><span>Pergunta <strong>{draft.question + 1}</strong> de 4</span></div><div className="question-progress" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={draft.question + 1} aria-label={`Pergunta ${draft.question + 1} de 4`}>{SALES_FIELDS.map((field, index) => <span key={field} className={index <= draft.question ? 'filled' : ''} />)}</div>
          <form className="question-form begin-enter" key={draft.question} onSubmit={event => { event.preventDefault(); if (advanceRef.current) clearTimeout(advanceRef.current); advance(draft.answers) }}><div className="question-title"><span className="begin-eyebrow">{copy.eyebrow}</span><h1 id="question-title" data-step-heading tabIndex={-1}>{copy.title}</h1><p>{copy.description}</p></div><fieldset className="question-options" aria-labelledby="question-title"><legend className="sr-only">{copy.title}</legend>{choices.map(item => <label key={item.id} className={`choice ${draft.answers[SALES_FIELDS[draft.question]] === item.id ? 'selected' : ''}`}><input type="radio" name={SALES_FIELDS[draft.question]} value={item.id} checked={draft.answers[SALES_FIELDS[draft.question]] === item.id} onChange={() => select(item.id)} onClick={() => { if (draft.answers[SALES_FIELDS[draft.question]] === item.id) select(item.id) }} /><span className="choice-icon"><DreamIcon name={item.icon || 'sprout'} size={22} /></span><span className="choice-text"><strong>{item.title}</strong>{'hint' in item && <small>{item.hint}</small>}</span><span className="choice-check" aria-hidden="true">{draft.answers[SALES_FIELDS[draft.question]] === item.id ? <Check size={13} strokeWidth={2.5} /> : null}</span></label>)}</fieldset>
            {draft.question === 1 && draft.answers.dream === 'other' && <div className="custom-dream"><label htmlFor="sales-custom-dream">Conte o que você quer realizar</label><textarea id="sales-custom-dream" className="ph-mask" rows={3} maxLength={300} value={draft.answers.customDream || ''} onChange={event => { const customDream = event.target.value; setDraft(current => ({ ...current, answers: { ...current.answers, customDream }, intentId: null })) }} /><div className="question-actions"><button type="submit" className="begin-primary" disabled={!salesStepComplete(draft.answers, 1)}>Continuar <ArrowRight size={18} /></button></div></div>}
          </form>
        </div>
      </>}
    </main>}
    {draft.screen === 'processing' && <main id="begin-main" className="sales-processing" aria-live="polite"><LoaderCircle size={38} className="animate-spin" /><span className="begin-eyebrow">DANDO FORMA AO SEU COMEÇO</span><h1 data-step-heading tabIndex={-1}>Seu sonho está<br /><em>ganhando um caminho.</em></h1><p>Analisando seu momento</p></main>}
    {draft.screen === 'closing' && <main id="begin-main" className="sales-closing">
      <section className="sales-intro" data-sales-event="closing_view"><div className="sales-intro-heading"><span className="begin-eyebrow"><Sparkles size={17} /> SEU PLANO</span><button type="button" className="guided-restart" onClick={restartFromBeginning} disabled={busy} aria-label="Refazer do início" title="Refazer do início"><RotateCcw size={20} aria-hidden="true" /></button></div><h1 data-step-heading tabIndex={-1}>{title.slice(0, titleGoalIndex)} <span className="sales-title-goal">{title.slice(titleGoalIndex + 1)}.</span></h1><div className="sales-promise"><span className="sales-promise-icon" aria-hidden="true"><Timer size={23} strokeWidth={2} /></span><div><small>{draft.answers.obstacle === 'time' ? 'Feito para rotina cheia' : 'Feito para o seu momento'}</small><strong>{OBSTACLE_PROMISES[draft.answers.obstacle as keyof typeof OBSTACLE_PROMISES]}</strong></div></div><p className="sales-after">Seu plano é criado depois da liberação, com base nas suas respostas.</p><div className="sales-phases"><h2>Seu objetivo vira<br />um jogo de fases.</h2><p>Uma etapa de cada vez. Você só precisa fazer a próxima.</p><div className="sales-numbers">{[['8', 'pilares'], ['64', 'etapas'], ['192', 'ações']].map(([number, label]) => <div key={number}><strong>{number}</strong><span>{label}</span></div>)}</div><div className="sales-phase-progress" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <span key={i} />)}</div><small>Fase 1 de 8</small></div></section>
      <section className="sales-stack" data-sales-event="stack_view"><h2>O que você recebe</h2><div>{STACK.map(([title, description, feature]) => <article key={title}><PlanFeaturePreview feature={feature} /><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></section>
      <section className="sales-example" data-sales-event="example_view"><h2>Como é uma tarefa por dentro</h2><p>Exemplo real do plano de quem quer correr uma meia maratona.</p><article className="sales-task"><header><span><Sparkles size={16} /> SEU FOCO AGORA</span><h3>Buscar provas no período</h3></header><div className="sales-task-body"><h4>Como fazer</h4><p className="sales-task-description">Faça uma busca inicial por meias maratonas previstas para os próximos 6 meses.</p><div className="sales-checklist-label"><h4>Checklist</h4><span>{checked.filter(Boolean).length}/3</span></div><div className="sales-checklist">{EXAMPLE_CHECKLIST.map((text, i) => <ChecklistItem key={text} text={text} checked={checked[i]} onToggle={() => setChecked(current => current.map((value, index) => index === i ? !value : value))} />)}</div><h4>Dica de Ouro</h4><blockquote>Use calendários oficiais de organizadores e confirme as informações diretamente.</blockquote></div></article></section>
      <section className="sales-offer" data-sales-event="offer_view"><h2>Libere seu plano.</h2><div className="sales-offer-goal"><span>Plano para</span><strong>{getDream(draft.answers)}{offerPeriod ? ` ${offerPeriod}` : ''}</strong></div><div className="sales-price"><span>Pagamento único</span><strong>R$ 37</strong><small>Sem assinatura.</small></div>{cta('offer')}<p className="sales-guarantee"><ShieldCheck size={18} /> Pix ou cartão · 7 dias de garantia</p><h3 className="sales-guarantee-title">7 dias de garantia</h3><p>Se o plano não fizer sentido para você, peça o reembolso em até 7 dias. Você recebe todo o valor de volta, sem precisar explicar o motivo.</p></section>
      <section className="sales-faq"><h2>Dúvidas</h2><details><summary>É assinatura?</summary><p>Não. Os R$ 37 são um pagamento único para criar um plano completo e acompanhar seu progresso.</p></details><details><summary>Funciona no celular?</summary><p>Sim. Você acessa o Mandalart pelo navegador do celular ou do computador e continua de onde parou.</p></details><details><summary>Como recebo o acesso?</summary><p>Após a confirmação do pagamento, você recebe o acesso por e-mail. Seu objetivo já estará preenchido. Responda às perguntas específicas para gerar seu plano.</p></details></section>
      <div className="sales-sticky" hidden={offerVisible}>{cta('sticky')}</div>
    </main>}
    {draft.screen === 'checkout' && <main id="begin-main" className="sales-checkout begin-enter"><button className="back-button" type="button" disabled={busy} onClick={() => navigate('closing')}><ArrowLeft size={16} /> Voltar ao plano</button><span className="begin-eyebrow">PAGAMENTO SEGURO</span><h1 data-step-heading tabIndex={-1}>Seu plano, por R$ 37.</h1><p>Pagamento único · garantia de 7 dias.</p><form onSubmit={checkout}>{directPix && !kiwify && <fieldset className="sales-method"><legend>Como você quer pagar?</legend><label><input type="radio" name="payment-method" checked={method === 'pix'} onChange={() => setMethod('pix')} disabled={busy} /> Pix</label><label><input type="radio" name="payment-method" checked={method === 'card'} onChange={() => setMethod('card')} disabled={busy} /> Cartão</label></fieldset>}{directPix && method === 'pix' && !kiwify && <label className="sales-email">E-mail para receber seu acesso<input className="ph-mask" type="email" autoComplete="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>}{error && <p className="begin-error" role="alert">{error}</p>}<button className="begin-primary sales-cta" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="animate-spin" size={18} /> Preparando pagamento…</> : <>{directPix && method === 'pix' && !kiwify ? 'Gerar Pix' : 'Continuar para pagamento'} · R$ 37 <ArrowRight size={18} /></>}</button><p className="sales-guarantee"><ShieldCheck size={16} /> Seu acesso é enviado após a confirmação.</p></form></main>}
    <footer className="begin-footer"><span>Feito para o seu próximo passo.</span><div><Link href="/privacidade">Privacidade</Link><span>·</span><Link href="/termos">Termos de uso</Link></div></footer>
  </div>
}
