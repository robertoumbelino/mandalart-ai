'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, BookmarkCheck, Check, ChevronDown, Clock3, CreditCard, LayoutGrid, Lightbulb, ListChecks, LockKeyhole, Mail, MonitorSmartphone, RotateCcw, Route, ShieldCheck, Sparkles, Sprout, X } from 'lucide-react'
import { PixMark } from '@/app/components/PixMark'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { getDream, type OnboardingAnswers, type OnboardingPreview } from '@/lib/onboarding'
import { ChecklistItem } from '@/app/components/ChecklistItem'

type Props = {
  previewId: string
  onViewed: (name: 'email_block_viewed' | 'offer_viewed') => void
  preview: OnboardingPreview
  answers: OnboardingAnswers
  checked: boolean[]
  onCheck: (index: number) => void
  onRestart: () => void
  onCheckout: () => void
  checkoutBusy: boolean
  directPixAvailable: boolean
  kiwifyCheckout: boolean
  kiwifyDemo: boolean
  kiwifyPreviewLinks: { one: string; three: string } | null
  checkoutMethod: 'pix' | 'card'
  onCheckoutMethodChange: (method: 'pix' | 'card') => void
  bumpSelected: boolean
  onBumpChange: (selected: boolean) => void
  checkoutError: string
  email: string
  onEmailChange: (email: string) => void
  onEmailSubmit: (event: FormEvent) => void
  emailBusy: boolean
  emailSaved: boolean
  emailError: string
}

export function Preview({ previewId, onViewed, preview, answers, checked, onCheck, onRestart, onCheckout, checkoutBusy, directPixAvailable, kiwifyCheckout, kiwifyDemo, kiwifyPreviewLinks, checkoutMethod, onCheckoutMethodChange, bumpSelected, onBumpChange, checkoutError, email, onEmailChange, onEmailSubmit, emailBusy, emailSaved, emailError }: Props) {
  const offerRef = useRef<HTMLElement>(null)
  const emailRef = useRef<HTMLElement>(null)
  const emailDialogRef = useRef<HTMLDialogElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const checkoutRef = useRef<HTMLButtonElement>(null)
  const [checkoutVisibleFor, setCheckoutVisibleFor] = useState<string | null>(null)
  const onViewedRef = useRef(onViewed)
  useEffect(() => { onViewedRef.current = onViewed }, [onViewed])
  useEffect(() => {
    const seen = new Set<string>()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target === checkoutRef.current) {
          setCheckoutVisibleFor(entry.isIntersecting ? previewId : null)
          continue
        }
        if (!entry.isIntersecting) continue
        const name = entry.target === offerRef.current ? 'offer_viewed' : 'email_block_viewed'
        if (seen.has(name)) continue
        seen.add(name)
        onViewedRef.current(name)
        observer.unobserve(entry.target)
      }
    }, { threshold: 0.25 })
    if (offerRef.current) observer.observe(offerRef.current)
    if (emailRef.current) observer.observe(emailRef.current)
    if (checkoutRef.current) observer.observe(checkoutRef.current)
    return () => observer.disconnect()
  }, [previewId])
  const dream = getDream(answers)
  const localTest = process.env.NODE_ENV === 'development'
  const localKiwifyDemo = kiwifyCheckout && kiwifyDemo
  const priceLabel = bumpSelected ? 'R$\u00a099' : 'R$\u00a037'
  const paymentCta = localKiwifyDemo
    ? `Simular compra de ${priceLabel}`
    : `Liberar ${bumpSelected ? '3 Mandalarts completos' : 'meu Mandalart completo'} · ${priceLabel}`
  return <>
    <main id="begin-main" className="conversion-preview conversion-preview--guided begin-enter">
      <header className="conversion-hero">
        <div>
          <span className="begin-eyebrow"><Sparkles size={15} /> SEU OBJETIVO, SEU CAMINHO</span>
          <h1 tabIndex={-1} data-step-heading>{dream}.</h1>
        </div>
        <button className="guided-restart" onClick={onRestart} disabled={checkoutBusy || emailBusy} aria-label="Refazer do início" title="Refazer do início"><RotateCcw size={20} aria-hidden="true" /></button>
      </header>

      <section ref={offerRef} className="conversion-offer conversion-offer--guided" aria-labelledby="conversion-offer-title">
        <h2 id="conversion-offer-title" className="guided-visually-hidden">Seu Mandalart completo</h2>
        <div className="conversion-offer-layout">
          <div className="guided-plan-overview">
            <div className="mandala-reveal" role="group" aria-label="Os oito caminhos do seu Mandalart completo">
              <div className="mandala-grid" role="group" aria-label="Oito caminhos ao redor do seu sonho">
                <div className="mandala-center"><span>OBJETIVO</span><strong title={dream}>{dream}</strong></div>
                {preview.pillars.map((pillar, index) =>
                  <div className={`mandala-cell ${index === 0 ? 'is-open' : 'is-locked'}`} key={index} aria-label={`Caminho ${index + 1}: ${pillar.title}${index ? ', ações disponíveis no plano completo' : ', primeiro passo gratuito disponível abaixo'}`}>
                    {index > 0 && <LockKeyhole className="mandala-lock" size={13} aria-hidden="true" />}
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong title={pillar.title}>{pillar.title}</strong>
                  </div>)}
              </div>
              <p className="mandala-note"><LockKeyhole size={15} aria-hidden="true" /><span>O plano completo libera as ações destes caminhos.</span></p>
            </div>
            <section ref={emailRef} className="guided-save-preview" aria-label="Guardar a prévia para voltar depois">
              <button type="button" className="guided-save-trigger" aria-haspopup="dialog" onClick={() => {
                emailDialogRef.current?.showModal()
                emailInputRef.current?.focus()
              }}>
                {emailSaved ? <Check size={18} aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}
                {emailSaved ? 'Prévia enviada para seu e-mail' : 'Receber minha prévia grátis'}
              </button>
              <small>Receba o link para voltar a este plano quando quiser.</small>
            </section>
            <section className="guided-outcomes" aria-labelledby="guided-outcomes-title">
              <span className="begin-eyebrow">O RESULTADO</span>
              <h3 id="guided-outcomes-title">Com o Mandalart, você vai</h3>
              <ol>
                <li><span className="guided-outcome-number" aria-hidden="true">01</span><div><strong>Saber o que fazer hoje</strong><p>O plano mostra a próxima tarefa, com instruções para começar.</p></div></li>
                <li><span className="guided-outcome-number" aria-hidden="true">02</span><div><strong>Avançar no seu ritmo</strong><p>Uma tarefa por vez, quando couber na sua rotina.</p></div></li>
                <li><span className="guided-outcome-number" aria-hidden="true">03</span><div><strong>Tirar seu sonho do papel</strong><p>Transforme seu objetivo em pequenas ações para colocar em prática.</p></div></li>
              </ol>
            </section>
          </div>
          <div className="conversion-offer-details">
            <div className="guided-included">
              <span className="begin-eyebrow">O QUE ESTÁ INCLUÍDO</span>
              <h3>Tudo o que você recebe</h3>
              <ul className="guided-benefits" aria-label="O que está incluído no Mandalart completo">
                <li><LayoutGrid size={20} aria-hidden="true" /><span><strong>Seu plano personalizado</strong><small>8 caminhos e 64 tarefas para o seu objetivo.</small></span></li>
                <li><Route size={20} aria-hidden="true" /><span><strong>Jornada guiada</strong><small>Uma tarefa por vez, na ordem recomendada.</small></span></li>
                <li><ListChecks size={20} aria-hidden="true" /><span><strong>Passo a passo para agir</strong><small>192 pequenas ações com instruções práticas.</small></span></li>
                <li><BookmarkCheck size={20} aria-hidden="true" /><span><strong>Checklists e progresso salvo</strong><small>Marque o que fez e retome de onde parou.</small></span></li>
                <li><Lightbulb size={20} aria-hidden="true" /><span><strong>Dicas em cada tarefa</strong><small>Orientação prática para ajudar você a avançar.</small></span></li>
                <li><MonitorSmartphone size={20} aria-hidden="true" /><span><strong>No celular e no computador</strong><small>Acesse pelo navegador, sem instalar nada.</small></span></li>
              </ul>
            </div>
            <div className="conversion-price"><strong>{bumpSelected ? 'R$ 99' : 'R$ 37'}</strong><span>pagamento único<br />sem assinatura</span></div>
            {directPixAvailable && <div className="conversion-payment-choice">
              <span>Como você quer pagar?</span>
              <div role="group" aria-label="Forma de pagamento">
                <button type="button" aria-pressed={checkoutMethod === 'pix'} onClick={() => onCheckoutMethodChange('pix')} disabled={checkoutBusy}>
                  <span className="conversion-payment-icon conversion-payment-icon--pix"><PixMark size={25} /></span>
                  <span className="conversion-payment-label"><strong>Pix</strong><small>QR Code no Mandalart</small></span>
                  <span className="conversion-payment-indicator" aria-hidden="true">{checkoutMethod === 'pix' && <Check size={13} strokeWidth={3} />}</span>
                </button>
                <button type="button" aria-pressed={checkoutMethod === 'card'} onClick={() => onCheckoutMethodChange('card')} disabled={checkoutBusy}>
                  <span className="conversion-payment-icon conversion-payment-icon--card"><CreditCard size={24} strokeWidth={1.8} /></span>
                  <span className="conversion-payment-label"><strong>Cartão de crédito</strong><small>Checkout seguro Asaas</small></span>
                  <span className="conversion-payment-indicator" aria-hidden="true">{checkoutMethod === 'card' && <Check size={13} strokeWidth={3} />}</span>
                </button>
              </div>
              {checkoutMethod === 'pix' && <label className="conversion-payment-email">Seu e-mail para receber o acesso<input type="email" value={email} onChange={event => onEmailChange(event.target.value)} autoComplete="email" placeholder="voce@exemplo.com" required /></label>}
            </div>}
            {checkoutError && <p role="alert" className="begin-error">{checkoutError}</p>}
            <button ref={checkoutRef} className="begin-primary" onClick={onCheckout} disabled={checkoutBusy}>{checkoutBusy ? (localKiwifyDemo ? 'Preparando simulação…' : 'Preparando pagamento…') : paymentCta} <ArrowRight size={18} aria-hidden="true" /></button>
            {kiwifyCheckout && <small>{localKiwifyDemo ? 'Simulação local sem cobrança. Em produção, Pix ou cartão no checkout seguro da Kiwify.' : 'Pix ou cartão no checkout seguro da Kiwify.'}</small>}
            {localKiwifyDemo && kiwifyPreviewLinks && <details className="guided-local-demo"><summary>Opções do teste local</summary><div className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <a className="font-semibold underline" href={bumpSelected ? kiwifyPreviewLinks.three : kiwifyPreviewLinks.one} target="_blank" rel="noopener noreferrer">Ver o checkout real da Kiwify para {priceLabel}</a>
              <p className="mt-1">Esse link serve para conferir a página. Uma compra feita por ele não será vinculada ao seu pedido local.</p>
            </div></details>}
            <section className="guided-guarantee" aria-labelledby="guided-guarantee-title">
              <ShieldCheck size={25} aria-hidden="true" />
              <div><h3 id="guided-guarantee-title">7 dias de garantia</h3><p>Se o plano não fizer sentido para você, peça o reembolso em até 7 dias após o pagamento. Você recebe todo o valor de volta, sem precisar explicar o motivo.</p></div>
            </section>
            <small>Compre sem cadastro prévio. Depois do pagamento, você recebe um e-mail para criar sua senha e acessar seu plano.</small>
            <details className="guided-extra-plans">
              <summary><span>{bumpSelected ? 'Mais 2 Mandalarts adicionados · total R$ 99' : 'Quer planejar mais de um sonho?'}</span><ChevronDown size={17} className="guided-disclosure-icon" aria-hidden="true" /></summary>
              <label className="conversion-bump"><input type="checkbox" checked={bumpSelected} disabled={checkoutBusy} onChange={event => onBumpChange(event.target.checked)} /><span className="conversion-bump-check" aria-hidden="true">{bumpSelected && <Check size={14} strokeWidth={3} />}</span><span><strong>Adicionar mais 2 Mandalarts por R$ 62</strong><small>Total R$ 99 para planejar 3 sonhos, sem assinatura.</small></span></label>
            </details>
          </div>
        </div>
      </section>

      <details className="guided-explore">
        <summary><Sprout size={20} aria-hidden="true" /><span><strong>Explorar meu primeiro passo</strong><small>Uma parte do seu plano, grátis.</small></span><ChevronDown size={20} className="guided-disclosure-icon" aria-hidden="true" /></summary>
        <section className="conversion-first-step" aria-labelledby="conversion-step-title">
          <span className="begin-eyebrow"><Sprout size={15} /> SEU PRIMEIRO PASSO GRÁTIS</span>
          <h2 id="conversion-step-title">{preview.pillars[0].title}</h2>
          {preview.firstStep.title !== preview.pillars[0].title && <h3 className="conversion-action-title">{preview.firstStep.title}</h3>}
          <p>{preview.firstStep.description}</p>
          <span className="conversion-duration"><Clock3 size={14} /> Cerca de {preview.firstStep.minutes} minutos</span>
          <div className="conversion-checklist">
            {preview.firstStep.checklist.map((item,index) => <ChecklistItem key={item} text={item} checked={checked[index]} onToggle={() => onCheck(index)} />)}
          </div>
          <small>{checked.filter(Boolean).length} de 3 pequenas ações concluídas</small>
          {checked.every(Boolean) && <div className="preview-reward" role="status"><strong>Primeiro passo concluído.</strong><p>Seu Mandalart completo mostra como continuar. O que você marcou aqui acompanha seu plano.</p></div>}
        </section>
      </details>

      <details className="guided-includes">
        <summary><span>Ver os 8 caminhos do meu plano</span><ChevronDown size={20} className="guided-disclosure-icon" aria-hidden="true" /></summary>
        <div className="guided-includes-body">
          <p>{preview.introduction}</p>
          <ol>{preview.pillars.map((pillar, index) => <li key={pillar.title}><strong>{index + 1}. {pillar.title}</strong><p>{pillar.description}</p></li>)}</ol>
        </div>
      </details>
      <figure className="conversion-testimonial">
        <figcaption>
          <Image src="/testimonials/kaua-santos.png" alt="" width={48} height={48} />
          <span><strong>Kauã Santos</strong><small>Plano e checklists</small></span>
        </figcaption>
        <blockquote>
          <span aria-hidden="true">“</span>
          <p>Finalmente consegui tirar esse plano do papel e realizar meu objetivo, um passo de cada vez…</p>
        </blockquote>
      </figure>

      <div className="conversion-faq">
        <details><summary>O que recebo ao comprar?</summary><p>Um Mandalart completo para o sonho que você acabou de configurar, com oito caminhos, 64 tarefas e progresso salvo.</p></details>
        <details><summary>Por que não simplesmente pedir um plano para uma IA?</summary><p>Você pode criar um plano em um chat. O Mandalart entrega uma estrutura pronta para usar: oito caminhos, ações com checklists, próximo passo e progresso salvo. Assim você não precisa organizar e manter tudo por conta própria.</p></details>
        <details><summary>Preciso criar uma senha?</summary><p>Você compra primeiro. Depois da confirmação, recebe um e-mail para concluir o cadastro com seu nome e uma senha. Nas próximas visitas, basta entrar com seu e-mail e senha. Se já tem uma conta, use seu acesso habitual.</p></details>
        <details><summary>Posso pedir reembolso?</summary><p>Sim. Veja as condições em <Link href="/reembolso">nossa política de reembolso</Link>.</p></details>
      </div>

      <dialog ref={emailDialogRef} className="guided-save-dialog" aria-labelledby="guided-save-title" aria-describedby="guided-save-description" onClick={event => {
        if (event.target === event.currentTarget) emailDialogRef.current?.close()
      }}>
        <div className="guided-save-dialog-content">
          <button type="button" className="guided-save-close" aria-label="Fechar envio da prévia" onClick={() => emailDialogRef.current?.close()}><X size={20} aria-hidden="true" /></button>
          <span className="guided-save-icon" aria-hidden="true">{emailSaved ? <Check size={26} /> : <Mail size={26} />}</span>
          <span className="begin-eyebrow">PARA VOLTAR DEPOIS</span>
          <h2 id="guided-save-title">{emailSaved ? 'Sua prévia está guardada.' : 'Guarde sua prévia grátis.'}</h2>
          <p id="guided-save-description">{emailSaved
            ? localTest ? 'Envio simulado com sucesso. Nenhum e-mail foi entregue à caixa de entrada.' : `Enviamos o link para ${email}. Volte ao seu plano quando quiser.`
            : 'Receba um link por e-mail para retomar seus 8 caminhos e o primeiro passo. Sem criar senha.'}</p>
          {emailSaved ? <button type="button" className="begin-primary" onClick={() => emailDialogRef.current?.close()}>Continuar na minha prévia <ArrowRight size={18} aria-hidden="true" /></button> : <form onSubmit={onEmailSubmit}>
            <label htmlFor="lead-email">Seu e-mail</label>
            <input ref={emailInputRef} id="lead-email" type="email" autoComplete="email" inputMode="email" required maxLength={254} disabled={emailBusy} value={email} onChange={event => onEmailChange(event.target.value)} placeholder="voce@exemplo.com" aria-describedby={emailError ? 'guided-save-note guided-save-error' : 'guided-save-note'} aria-invalid={Boolean(emailError)} />
            {emailError && <p id="guided-save-error" role="alert" className="begin-error">{emailError}</p>}
            <button type="submit" className="begin-primary" disabled={emailBusy || !email.trim()}>{emailBusy ? 'Enviando…' : 'Receber minha prévia grátis'} <ArrowRight size={18} aria-hidden="true" /></button>
            <small id="guided-save-note">Você receberá o link desta prévia e até dois lembretes. Pode cancelar pelos links nos e-mails.</small>
          </form>}
        </div>
      </dialog>
    </main>
    {checkoutVisibleFor !== previewId && <div className="conversion-sticky conversion-sticky--guided"><span><strong>{bumpSelected ? '3 Mandalarts completos' : 'Seu Mandalart completo'}</strong><small>{priceLabel} · pagamento único</small></span><button onClick={onCheckout} disabled={checkoutBusy}>{localKiwifyDemo ? `Simular ${priceLabel}` : `Liberar por ${priceLabel}`} <ArrowRight size={16} /></button></div>}
  </>
}
