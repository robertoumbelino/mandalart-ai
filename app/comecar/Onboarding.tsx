'use client'

import { startGuestCheckout } from '@/actions/onboarding-checkout'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { track } from '@vercel/analytics'
import { sendGoogleAnalyticsEvent } from '@/app/components/GoogleAnalytics'
import { captureProductEvent } from '@/lib/posthog'
import { captureAttribution } from '@/lib/attribution'
import { trackMetaEvent } from '@/lib/meta-events'
import { MARKETING_CONSENT_KEY } from '@/lib/marketing-consent'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Heart,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sprout,
  X
} from 'lucide-react'
import {
  answerFields,
  answersKey,
  answersSchema,
  CATEGORIES,
  DRAFT_STORAGE_KEY,
  getDream,
  HORIZONS,
  isStepComplete,
  OBSTACLES,
  previewSchema,
  restoreDraft,
  STAGES,
  TIME_OPTIONS,
  type DraftAnswers,
  type OnboardingDraft,
  type PreviewResponse
} from '@/lib/onboarding'
import { DreamIcon, HeroArtwork, MandalaBloom } from './Visuals'
import { BrandLogo } from '@/app/components/Brand'
import { Preview } from './Preview'

type Screen = OnboardingDraft['screen']
type Choice = { id: string; title: string; hint?: string; icon?: string }
const EMPTY: OnboardingDraft = {
  version: 1,
  savedAt: 0,
  screen: 'welcome',
  question: 0,
  answers: {},
  result: null,
  checked: [false, false, false],
  attribution: {},
  pack: 1,
  leadId: null
}
const QUESTION_COPY = [
  {
    eyebrow: 'UM ESPAÇO PARA O QUE IMPORTA',
    title: 'Onde você quer ver a vida florescer?',
    description: 'Escolha a área que mais importa para você agora.',
    reassurance: 'Não precisa mudar tudo. Um sonho de cada vez.'
  },
  {
    eyebrow: 'VAMOS DAR UM NOME A ESSE SONHO',
    title: 'O que você gostaria de realizar?',
    description: 'Escolha o sonho que mais combina com o seu momento.',
    reassurance: 'Pode ser grande, pequeno ou só seu. O sonho é seu.'
  },
  {
    eyebrow: 'TODO COMEÇO TEM SEU VALOR',
    title: 'Como está esse sonho hoje?',
    description: 'Não existe resposta certa. Vamos partir de onde você está.',
    reassurance: 'Você não precisa estar pronto. Só precisa de um começo.'
  },
  {
    eyebrow: 'UM POUCO MAIS DE CLAREZA',
    title: 'O que torna o próximo passo mais difícil?',
    description: 'Escolha o que mais pesa hoje. Vamos levar isso em conta.',
    reassurance: 'Um bom plano também respeita o que é difícil.'
  },
  {
    eyebrow: 'UM PLANO QUE CABE NA VIDA',
    title: 'Quanto tempo cabe na sua semana?',
    description: 'Pense na sua rotina de verdade, não na semana perfeita.',
    reassurance: 'Pequenos passos, repetidos com carinho, também levam longe.'
  },
  {
    eyebrow: 'O SEU TEMPO, O SEU CAMINHO',
    title: 'Quando você quer ver os primeiros avanços?',
    description:
      'Esse período orienta o começo. Não é uma cobrança para realizar tudo.',
    reassurance: 'Seu sonho não precisa de pressa. Precisa de espaço.'
  }
]

function analytics(name: string, properties?: Record<string, string | number>) {
  let leadId = ''
  try { leadId = sessionStorage.getItem('mandalart.lead_id') || '' } catch {}
  const enriched = { ...captureAttribution(), ...(leadId ? { lead_id: leadId } : {}), ...properties }
  captureProductEvent(name, enriched)
  try {
    track(name, enriched)
  } catch {
    /* Analytics must never interrupt the journey. */
  }
  try {
    sendGoogleAnalyticsEvent(name, enriched)
  } catch {
    /* Analytics must never interrupt the journey. */
  }
}

export function Onboarding() {
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY)
  const [hydrated, setHydrated] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [blocked, setBlocked] = useState<'illegal' | 'self-harm'>('illegal')
  const [dialog, setDialog] = useState<'restart' | null>(null)
  const [slow, setSlow] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const customRef = useRef<HTMLTextAreaElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const busyRef = useRef(false)
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let restored: OnboardingDraft | null = null
      try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
        if (raw) restored = restoreDraft(JSON.parse(raw))
      } catch {
        setStorageAvailable(false)
      }
      const initial = restored || {
        ...EMPTY,
        attribution: {},
        savedAt: Date.now()
      }
      initial.attribution = { ...initial.attribution, ...captureAttribution() }
      const state = window.history.state?.mandalartBegin
      if (state && ['welcome', 'questions', 'email', 'preview'].includes(state.screen)) {
        if (state.screen === 'welcome') initial.screen = 'welcome'
        else if (state.screen === 'email') initial.screen = 'email'
        else if (state.screen === 'preview' && initial.result)
          initial.screen = 'preview'
        else if (state.screen === 'questions') {
          initial.screen = 'questions'
          const missing = answerFields.findIndex(
            (_, step) => !isStepComplete(initial.answers, step)
          )
          initial.question = Math.max(
            0,
            Math.min(Number(state.question) || 0, missing < 0 ? 5 : missing)
          )
        }
      }
      setDraft(initial)
      window.history.replaceState(
        {
          ...window.history.state,
          mandalartBegin: { screen: initial.screen, question: initial.question }
        },
        ''
      )
      setHydrated(true)
      analytics('landing_view')
      void fetch('/api/onboarding/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'landing_view', attribution: initial.attribution }) }).catch(() => {})
      if (new URLSearchParams(window.location.search).has('retomar')) {
        void fetch('/api/onboarding/restore').then(response => response.json()).then(result => {
          if (result.status !== 'ready') return
          const answers = answersSchema.parse(result.answers)
          const preview = previewSchema.parse(result.preview)
          setDraft(current => ({ ...current, answers, attribution: result.attribution || {}, leadId: result.leadId, result: { id: result.id, preview, answersKey: answersKey(answers) }, screen: 'preview', question: 5 }))
          try { sessionStorage.setItem('mandalart.lead_id', result.leadId) } catch {}
          window.history.replaceState({ ...window.history.state, mandalartBegin: { screen: 'preview', question: 5 } }, '', '/comecar')
        }).catch(() => {})
      }
    })
    const onPop = (event: PopStateEvent) => {
      requestRef.current?.abort()
      if (advanceRef.current) clearTimeout(advanceRef.current)
      busyRef.current = false
      setError('')
      setDialog(null)
      const state = event.state?.mandalartBegin
      setDraft((current) => {
        const screen =
          state?.screen === 'preview' && current.result
            ? 'preview'
            : state?.screen === 'email'
              ? 'email'
              : state?.screen === 'questions' || state?.screen === 'generating'
              ? 'questions'
              : 'welcome'
        const missing = answerFields.findIndex(
          (_, index) => !isStepComplete(current.answers, index)
        )
        return {
          ...current,
          screen,
          question: Math.max(
            0,
            Math.min(Number(state?.question) || 0, missing < 0 ? 5 : missing)
          )
        }
      })
    }
    window.addEventListener('popstate', onPop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('popstate', onPop)
      requestRef.current?.abort()
      if (advanceRef.current) clearTimeout(advanceRef.current)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    captureProductEvent('screen_view', {
      screen: `onboarding_${draft.screen}`,
      step: draft.screen === 'questions' ? draft.question + 1 : 0,
    })
  }, [draft.screen, draft.question, hydrated])

  useEffect(() => {
    if (!hydrated || draft.screen !== 'preview' || !draft.result) return
    trackMetaEvent({ name: 'ViewContent', onceKey: `preview.${draft.result.id}`, eventId: `preview-${draft.result.id}` })
    analytics('preview_viewed', { lead_id: draft.leadId || '' })
    void fetch('/api/onboarding/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'preview_viewed', leadId: draft.leadId || undefined, attribution: draft.attribution }) }).catch(() => {})
  }, [draft.screen, draft.result, draft.leadId, draft.attribution, hydrated])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ ...draft, savedAt: Date.now() })
      )
    } catch {
      queueMicrotask(() => setStorageAvailable(false))
    }
  }, [draft, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' })
      document
        .querySelector<HTMLElement>('[data-step-heading]')
        ?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [draft.screen, draft.question, hydrated])

  useEffect(() => {
    if (dialog && !dialogRef.current?.open) dialogRef.current?.showModal()
    if (!dialog && dialogRef.current?.open) dialogRef.current?.close()
  }, [dialog])

  useEffect(() => {
    if (draft.screen !== 'generating') return
    const timer = setTimeout(() => setSlow(true), 15_000)
    return () => clearTimeout(timer)
  }, [draft.screen])

  const navigate = useCallback(
    (screen: Screen, question = 0, replace = false) => {
      setError('')
      setDraft((current) => ({ ...current, screen, question }))
      window.history[replace ? 'replaceState' : 'pushState'](
        { ...window.history.state, mandalartBegin: { screen, question } },
        ''
      )
    },
    []
  )

  function select(value: string) {
    const field = answerFields[draft.question]
    setDraft((current) => {
      const answers: DraftAnswers = { ...current.answers, [field]: value }
      if (field === 'category') {
        delete answers.dream
        delete answers.customDream
      }
      if (field === 'dream' && value !== 'other') delete answers.customDream
      return {
        ...current,
        answers,
        result: null,
        checked: [false, false, false]
      }
    })
    if (field === 'dream' && value === 'other')
      requestAnimationFrame(() => customRef.current?.focus())
    else {
      if (advanceRef.current) clearTimeout(advanceRef.current)
      const question = draft.question
      advanceRef.current = setTimeout(() => {
        analytics('quiz_question', { question: question + 1 })
        void fetch('/api/onboarding/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'quiz_question', properties: { question: question + 1 }, leadId: draft.leadId || undefined, attribution: draft.attribution }) }).catch(() => {})
        if (question === 5) {
          analytics('quiz_completed')
          void fetch('/api/onboarding/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'quiz_completed', attribution: draft.attribution }) }).catch(() => {})
          navigate('email', 5)
        } else navigate('questions', question + 1)
      }, 180)
    }
    setError('')
  }

  async function generate() {
    if (busyRef.current) return
    const parsed = answersSchema.safeParse(draft.answers)
    if (!parsed.success) {
      const missing = answerFields.findIndex(
        (_, index) => !isStepComplete(draft.answers, index)
      )
      navigate('questions', Math.max(0, missing))
      setError('Escolha uma resposta para continuar.')
      return
    }
    if (draft.result?.answersKey === answersKey(parsed.data)) {
      navigate('preview')
      return
    }
    busyRef.current = true
    const controller = new AbortController()
    requestRef.current = controller
    const timeout = setTimeout(() => controller.abort('timeout'), 85_000)
    setSlow(false)
    navigate('generating', 5)
    analytics('begin_preview_requested')
    try {
      const response = await fetch('/api/onboarding/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: parsed.data,
          attribution: draft.attribution
        }),
        signal: controller.signal
      })
      const result = (await response.json()) as PreviewResponse
      if (controller.signal.aborted) return
      if (result.status === 'ready') {
        const preview = previewSchema.parse(result.preview)
        setDraft((current) => ({
          ...current,
          result: {
            id: result.id,
            preview,
            answersKey: answersKey(parsed.data)
          },
          checked: [false, false, false]
        }))
        navigate('preview', 5, true)
        analytics('begin_preview_ready')
      } else if (result.status === 'blocked') {
        setBlocked(result.category)
        navigate('blocked', 1, true)
      } else {
        navigate('questions', 5, true)
        setError(
          result.message ||
            'Não conseguimos preparar sua prévia agora. Tente novamente.'
        )
        analytics('begin_preview_error')
      }
    } catch {
      if (controller.signal.aborted && controller.signal.reason !== 'timeout')
        return
      navigate('questions', 5, true)
      setError(
        'A conexão não respondeu a tempo. Suas respostas continuam aqui. Tente novamente.'
      )
      analytics('begin_preview_error')
    } finally {
      clearTimeout(timeout)
      if (requestRef.current === controller) {
        busyRef.current = false
        requestRef.current = null
      }
    }
  }

  function next(event: React.FormEvent) {
    event.preventDefault()
    if (!isStepComplete(draft.answers, draft.question)) return
    analytics('begin_question_completed', { step: draft.question + 1 })
    void fetch('/api/onboarding/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'quiz_question', properties: { question: draft.question + 1 }, attribution: draft.attribution }) }).catch(() => {})
    if (draft.question === 5) navigate('email', 5)
    else navigate('questions', draft.question + 1)
  }

  function resume() {
    if (draft.result) navigate('preview')
    else {
      const missing = answerFields.findIndex(
        (_, index) => !isStepComplete(draft.answers, index)
      )
      navigate('questions', missing < 0 ? 5 : missing)
    }
    analytics('quiz_started')
    void fetch('/api/onboarding/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'quiz_started', attribution: draft.attribution }) }).catch(() => {})
  }

  async function captureEmail(event: React.FormEvent) {
    event.preventDefault()
    if (emailBusy || busyRef.current) return
    const parsed = answersSchema.safeParse(draft.answers)
    if (!parsed.success) { navigate('questions', 0); return }
    setEmailBusy(true)
    setError('')
    try {
      let marketingConsent = false
      try { marketingConsent = localStorage.getItem(MARKETING_CONSENT_KEY) === 'accepted' } catch {}
      const response = await fetch('/api/onboarding/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, answers: parsed.data, attribution: draft.attribution, marketingConsent }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível guardar seu e-mail.')
      setDraft(current => ({ ...current, leadId: result.id }))
      try { sessionStorage.setItem('mandalart.lead_id', result.id) } catch {}
      analytics('email_captured', { lead_id: result.id })
      trackMetaEvent({ name: 'Lead', onceKey: `lead.${result.id}`, eventId: `lead-${result.id}` })
      void generate()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Tente novamente.')
    } finally { setEmailBusy(false) }
  }

  async function checkout() {
    if (!draft.result || checkoutBusy) return
    setCheckoutBusy(true)
    try {
      const orderId = crypto.randomUUID()
      analytics('unlock_clicked', { lead_id: draft.leadId || '' })
      void fetch('/api/onboarding/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'unlock_clicked', leadId: draft.leadId || undefined, attribution: draft.attribution }) }).catch(() => {})
      const result = await startGuestCheckout(draft.result.id, orderId)
      analytics('checkout_started', { lead_id: draft.leadId || '' })
      trackMetaEvent({ name: 'InitiateCheckout', data: { value: 37, currency: 'BRL' }, onceKey: `checkout.${orderId}`, eventId: `checkout-${orderId}` })
      window.location.assign(result.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir o checkout.')
      setCheckoutBusy(false)
    }
  }
  const category = CATEGORIES.find((item) => item.id === draft.answers.category)
  const copy = QUESTION_COPY[draft.question]
  const choiceSets: Choice[][] = [
    [...CATEGORIES],
    [
      ...(category?.dreams || []).map((title) => ({ id: title, title })),
      { id: 'other', title: 'Meu sonho é outro', icon: 'idea' }
    ],
    [...STAGES],
    [...OBSTACLES],
    [...TIME_OPTIONS],
    [...HORIZONS]
  ]
  const started = !!draft.answers.category
  const isPreview = draft.screen === 'preview' && !!draft.result

  return (
    <div className={`begin-shell ${isPreview ? 'has-preview' : ''}`}>
      <a href="#begin-main" className="begin-skip">
        Pular para o conteúdo
      </a>
      <header className="begin-header">
        <button
          className="begin-brand"
          aria-label="Mandalart.AI — ir ao início"
          onClick={() => {
            requestRef.current?.abort()
            busyRef.current = false
            navigate('welcome')
          }}
        >
          <BrandLogo iconSize={29} />
        </button>
        {draft.screen === 'welcome' ? (
          <Link href="/" className="begin-login">
            Já tenho conta <ArrowRight size={14} />
          </Link>
        ) : (
          <span className="header-assurance">
            <span className="live-dot" /> No seu ritmo.
          </span>
        )}
      </header>
      {!storageAvailable && (
        <p className="storage-notice" role="status">
          Seu navegador não permitiu salvar o progresso. Você pode continuar,
          mas mantenha esta página aberta.
        </p>
      )}

      {draft.screen === 'welcome' && (
        <main id="begin-main" className="welcome-page begin-enter">
          <section className="welcome-hero">
            <div className="welcome-copy">
              <span className="begin-eyebrow">
                <span className="eyebrow-star">✦</span> O SEU PRÓXIMO CAPÍTULO
              </span>
              <h1 tabIndex={-1} data-step-heading>
                Seu sonho merece
                <br />
                <em>um primeiro passo.</em>
              </h1>
              <p className="hero-description">
                Aquela ideia que não sai da cabeça. Aquela vontade guardada.
                Vamos encontrar um jeito de começar?
              </p>
              <p className="hero-invitation">
                6 perguntas simples. Um começo com a sua cara.
              </p>
              <button
                className="begin-primary hero-cta"
                disabled={!hydrated}
                onClick={resume}
              >
                {started
                  ? 'Continuar meu caminho'
                  : 'Descobrir meu primeiro passo'}
                <ArrowRight size={19} />
              </button>
              <div className="hero-trust">
                <span>
                  <Check size={14} /> Prévia gratuita
                </span>
                <span>
                  <Check size={14} /> Sem cartão para descobrir seu primeiro caminho
                </span>
              </div>
              <p className="hero-fineprint">
                O planner completo é pago. Sem assinatura.
              </p>
              {started && (
                <button
                  className="text-button restart-link"
                  onClick={() => setDialog('restart')}
                >
                  <RotateCcw size={13} /> Começar um novo sonho
                </button>
              )}
            </div>
            <HeroArtwork />
          </section>
          <section className="welcome-how" aria-label="Como funciona">
            <div className="how-heading">
              <span className="begin-eyebrow">
                DA VONTADE AO PRIMEIRO PASSO
              </span>
              <p>Você não precisa ter tudo resolvido.</p>
            </div>
            <ol>
              <li>
                <span className="how-number">01</span>
                <div>
                  <strong>Conte seu sonho</strong>
                  <p>Do seu jeito, com escolhas simples.</p>
                </div>
              </li>
              <li>
                <span className="how-number">02</span>
                <div>
                  <strong>Encontre um começo</strong>
                  <p>Uma prévia pensada para o seu momento.</p>
                </div>
              </li>
              <li>
                <span className="how-number">03</span>
                <div>
                  <strong>Escolha continuar</strong>
                  <p>Conheça o planner completo, se fizer sentido.</p>
                </div>
              </li>
            </ol>
          </section>
          <p className="welcome-note">
            <Heart size={15} strokeWidth={1.5} /> Um espaço para sonhar com os
            pés no chão.
          </p>
        </main>
      )}

      {draft.screen === 'questions' && (
        <main id="begin-main" className="questions-page">
          <aside className="question-aside">
            <span className="begin-eyebrow">UM SONHO, MUITOS CAMINHOS</span>
            <MandalaBloom compact progress={draft.question + 2} />
            <p className="aside-quote">{copy.reassurance}</p>
            {getDream(draft.answers) && (
              <div className="aside-dream">
                <DreamIcon name={category?.icon || 'sprout'} size={18} />
                <span className="ph-mask">{getDream(draft.answers)}</span>
              </div>
            )}
            <span className="aside-caption">
              Um pouco de clareza faz espaço para o possível.
            </span>
          </aside>
          <div className="question-panel">
            <div className="question-navigation">
              <button
                className="back-button"
                onClick={() =>
                  navigate(
                    draft.question === 0 ? 'welcome' : 'questions',
                    Math.max(0, draft.question - 1)
                  )
                }
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <span>
                Pergunta <strong>{draft.question + 1}</strong> de 6
              </span>
            </div>
            <div
              className="question-progress"
              aria-label={`Pergunta ${draft.question + 1} de 6`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={6}
              aria-valuenow={draft.question + 1}
            >
              {answerFields.map((field, index) => (
                <span
                  key={field}
                  className={index <= draft.question ? 'filled' : ''}
                />
              ))}
            </div>
            <form
              className="question-form begin-enter"
              key={draft.question}
              onSubmit={next}
            >
              <div className="question-title">
                <span className="begin-eyebrow">{copy.eyebrow}</span>
                <h1 id="question-title" data-step-heading tabIndex={-1}>
                  {copy.title}
                </h1>
                <p id="question-description">{copy.description}</p>
              </div>
              <fieldset
                className={`question-options ${draft.question === 0 ? 'category-options' : ''}`}
                aria-labelledby="question-title"
                aria-describedby="question-description"
              >
                <legend className="sr-only">{copy.title}</legend>
                {choiceSets[draft.question].map((choice) => {
                  const selected =
                    draft.answers[answerFields[draft.question]] === choice.id
                  return (
                    <label
                      className={`choice ${selected ? 'selected' : ''} ${draft.question === 0 ? `tone-${choice.id}` : ''}`}
                      key={choice.id}
                    >
                      <input
                        type="radio"
                        name={answerFields[draft.question]}
                        value={choice.id}
                        checked={selected}
                        onChange={() => select(choice.id)}
                      />
                      {choice.icon && (
                        <span className="choice-icon">
                          <DreamIcon name={choice.icon} />
                        </span>
                      )}
                      <span className="choice-text">
                        <strong>{choice.title}</strong>
                        {choice.hint && <small>{choice.hint}</small>}
                      </span>
                      <span className="choice-check" aria-hidden="true">
                        {selected ? (
                          <Check size={13} strokeWidth={2.5} />
                        ) : null}
                      </span>
                    </label>
                  )
                })}
              </fieldset>
              {draft.question === 1 && draft.answers.dream === 'other' && (
                <div className="custom-dream begin-enter">
                  <label htmlFor="custom-dream">
                    Conte seu sonho em uma frase.
                  </label>
                  <p>Não precisa escrever bonito. Só dizer o que você quer.</p>
                  <textarea
                    ref={customRef}
                    id="custom-dream"
                    value={draft.answers.customDream || ''}
                    maxLength={300}
                    rows={3}
                    placeholder="Ex.: transformar meus bolos em um pequeno negócio"
                    aria-describedby="custom-dream-count"
                    onChange={(event) => {
                      const value = event.target.value
                      setDraft((current) => ({
                        ...current,
                        answers: { ...current.answers, customDream: value },
                        result: null,
                        checked: [false, false, false]
                      }))
                    }}
                  />
                  <span id="custom-dream-count">
                    {(draft.answers.customDream || '').trim().length < 5
                      ? 'Escreva pelo menos 5 caracteres.'
                      : 'Seu sonho não precisa caber em uma categoria.'}
                    <span>{draft.answers.customDream?.length || 0}/300</span>
                  </span>
                </div>
              )}
              {error && (
                <div className="ph-mask begin-error" role="alert">
                  {error}
                </div>
              )}
              {draft.question === 1 && draft.answers.dream === 'other' && <div className="question-actions">
                <button
                  className="begin-primary"
                  type="submit"
                  disabled={!isStepComplete(draft.answers, draft.question)}
                >
                  Continuar <ArrowRight size={18} />
                </button>
                <p><Sprout size={13} /> Seu ritmo também faz parte do plano.</p>
              </div>}
            </form>
          </div>
        </main>
      )}

      {draft.screen === 'email' && (
        <main id="begin-main" className="email-page begin-enter">
          <div className="email-card">
            <span className="begin-eyebrow"><Sparkles size={15} /> SEU PRIMEIRO CAMINHO</span>
            <h1 tabIndex={-1} data-step-heading>Vamos criar seu primeiro caminho.</h1>
            <p>Deixe seu e-mail para receber a prévia e continuar em qualquer aparelho.</p>
            <form onSubmit={captureEmail}>
              <label htmlFor="lead-email">Seu e-mail</label>
              <input id="lead-email" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@exemplo.com" />
              {error && <p role="alert" className="begin-error">{error}</p>}
              <button className="begin-primary" type="submit" disabled={emailBusy || !email.trim()}>{emailBusy ? 'Criando seu caminho…' : 'Criar e ver meu caminho'} <ArrowRight size={18} /></button>
            </form>
            <small>Sem senha e sem cartão. Enviaremos sua prévia, até dois lembretes deste caminho e, se você comprar, o acesso ao plano. Cancele os lembretes pelo link em qualquer e-mail.</small>
            <button className="text-button" onClick={() => navigate('questions', 5)}><ArrowLeft size={14} /> Revisar respostas</button>
          </div>
        </main>
      )}

      {draft.screen === 'generating' && (
        <main id="begin-main" className="generation-page begin-enter">
          <div className="generation-bloom">
            <MandalaBloom />
          </div>
          <span className="begin-eyebrow">DANDO FORMA AO SEU COMEÇO</span>
          <h1 tabIndex={-1} data-step-heading>
            Seu sonho está
            <br />
            <em>ganhando um caminho.</em>
          </h1>
          <p role="status" aria-live="polite">
            {slow
              ? 'Estamos levando um pouco mais de tempo para preparar sua prévia. Suas respostas estão aqui.'
              : 'Estamos preparando uma prévia com o seu objetivo, o seu momento e o tempo que você tem.'}
          </p>
          <div className="generation-dream">
            <LoaderCircle className="begin-spinner" size={17} />
            <span className="ph-mask">{getDream(draft.answers)}</span>
          </div>
          <p className="generation-note">
            Um plano feito para a vida real. A sua.
          </p>
          <button
            className="text-button"
            onClick={() => {
              requestRef.current?.abort()
              busyRef.current = false
              navigate('questions', 5, true)
            }}
          >
            <ArrowLeft size={14} /> Voltar às respostas
          </button>
        </main>
      )}

      {isPreview && (
        <Preview
          preview={draft.result!.preview}
          answers={answersSchema.parse(draft.answers)}
          checked={draft.checked}
          onCheck={(index) => {
            setDraft((current) => ({
              ...current,
              checked: current.checked.map((value, i) =>
                i === index ? !value : value
              )
            }))
            analytics('begin_first_step_interaction')
          }}
          onEdit={() => navigate('questions', 0)}
          onCheckout={checkout}
          checkoutBusy={checkoutBusy}
          checkoutError={error}
        />
      )}

      {draft.screen === 'blocked' && (
        <main id="begin-main" className="blocked-page begin-enter">
          <span className="blocked-symbol">
            <Heart size={32} strokeWidth={1.5} />
          </span>
          <span className="begin-eyebrow">
            {blocked === 'self-harm' ? 'VOCÊ IMPORTA' : 'UM CAMINHO SEGURO'}
          </span>
          <h1 tabIndex={-1} data-step-heading>
            {blocked === 'self-harm'
              ? 'Vamos cuidar de você primeiro.'
              : 'Vamos encontrar outro caminho?'}
          </h1>
          {blocked === 'self-harm' ? (
            <>
              <p>
                Sinto muito que você esteja passando por isso. Seu plano pode
                esperar. Procure alguém de confiança para estar com você agora.
              </p>
              <p>
                Se houver risco imediato, ligue <a href="tel:192">192 (SAMU)</a>
                . Para conversar, o <a href="tel:188">CVV atende pelo 188</a>,
                gratuitamente, 24 horas.
              </p>
            </>
          ) : (
            <p>
              Não podemos criar planos para atividades ilegais, violência ou
              ações que prejudiquem outras pessoas. Você pode reformular seu
              objetivo para um caminho seguro.
            </p>
          )}
          <button
            className="begin-primary"
            onClick={() => navigate('questions', 1, true)}
          >
            <ArrowLeft size={17} />{' '}
            {blocked === 'self-harm'
              ? 'Voltar às minhas respostas'
              : 'Reformular meu sonho'}
          </button>
        </main>
      )}

      <footer className="begin-footer">
        <span>Feito para o seu próximo passo.</span>
        <div>
          <Link href="/privacidade" target="_blank" rel="noopener noreferrer">
            Privacidade
          </Link>
          <span>·</span>
          <Link href="/termos" target="_blank" rel="noopener noreferrer">
            Termos de uso
          </Link>
        </div>
      </footer>

      <dialog
        ref={dialogRef}
        className="begin-dialog"
        aria-labelledby="begin-dialog-title"
        onCancel={() => setDialog(null)}
        onClose={() => setDialog(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDialog(null)
        }}
      >
        <div className="dialog-content">
          <button
            className="dialog-close"
            aria-label="Fechar"
            onClick={() => setDialog(null)}
          >
            <X size={20} />
          </button>
          <span className="dialog-flower">
            <Sprout size={32} strokeWidth={1.4} />
          </span>
          <span className="begin-eyebrow">UM NOVO COMEÇO</span>
          <h2 id="begin-dialog-title">Espaço para outro sonho?</h2>
          <p>Ao começar de novo, as respostas e a prévia deste sonho serão substituídas neste navegador.</p>
          <button
            className="begin-primary"
            onClick={() => {
              if (dialog === 'restart') {
                setDraft({
                  ...EMPTY,
                  attribution: draft.attribution,
                  savedAt: Date.now()
                })
                navigate('questions', 0, true)
              }
              setDialog(null)
            }}
          >
            {dialog === 'restart'
              ? 'Começar um novo sonho'
              : 'Continuar com minha prévia'}
            <ChevronRight size={17} />
          </button>
          {dialog === 'restart' && (
            <button
              className="text-button dialog-cancel"
              onClick={() => setDialog(null)}
            >
              Manter meu sonho atual
            </button>
          )}
          <span className="dialog-footnote">
            <ShieldCheck size={13} /> No seu tempo, sem compromisso.
          </span>
        </div>
      </dialog>
    </div>
  )
}
