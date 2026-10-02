'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Check, ChevronRight, Clock3, CreditCard, LockKeyhole, Mail, RotateCcw, ShieldCheck, Sparkles, Sprout } from 'lucide-react'
import { PixMark } from '@/app/components/PixMark'
import { useEffect, useRef, type FormEvent } from 'react'
import { getDream, previewHeading, type OnboardingAnswers, type OnboardingPreview } from '@/lib/onboarding'
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
  const onViewedRef = useRef(onViewed)
  useEffect(() => { onViewedRef.current = onViewed }, [onViewed])
  useEffect(() => {
    const seen = new Set<string>()
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
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
    return () => observer.disconnect()
  }, [previewId])
  const dream = getDream(answers)
  const localTest = process.env.NODE_ENV === 'development'
  const localKiwifyDemo = kiwifyCheckout && kiwifyDemo
  const priceLabel = bumpSelected ? 'R$ 99' : 'R$ 37'
  const paymentCta = localKiwifyDemo
    ? `Simular compra de ${priceLabel}`
    : directPixAvailable
    ? checkoutMethod === 'pix' ? `Pagar ${priceLabel} com Pix` : `Pagar ${priceLabel} com cartão`
    : `Continuar para pagar ${priceLabel}`
  return <>
    <main id="begin-main" className="conversion-preview begin-enter">
      <header className="conversion-hero">
        <div>
          <span className="begin-eyebrow"><Sparkles size={15} /> SUA PRÉVIA PERSONALIZADA</span>
          <h1 tabIndex={-1} data-step-heading>{previewHeading(preview.title)}.</h1>
        </div>
        <button className="text-button" onClick={onRestart} disabled={checkoutBusy || emailBusy}><RotateCcw size={14} /> Refazer do início</button>
      </header>

      <section className="mandala-reveal" aria-label="Seu Mandalart começando a tomar forma">
        <div className="mandala-grid" role="group" aria-label="Oito caminhos ao redor do seu sonho">
          {[0,1,2,7,-1,3,6,5,4].map(index => index === -1
            ? <div className="mandala-center" key="center"><span>SEU SONHO</span><strong>{dream}</strong></div>
            : <div className={`mandala-cell ${index === 0 ? 'is-open' : 'is-locked'}`} key={index} data-path={index + 1} aria-label={`Caminho ${index + 1}: ${preview.pillars[index].title}${index ? ', ações disponíveis no plano completo' : ', primeiro passo disponível abaixo'}`}>
                <span>{index === 0 ? <Sprout size={14} /> : <LockKeyhole size={12} />} CAMINHO {index + 1}</span>
                <strong>{preview.pillars[index].title}</strong>
              </div>)}
        </div>
        <details className="preview-path-details"><summary><ChevronRight size={17} aria-hidden="true" /><span>Entenda o papel de cada caminho</span></summary><p>{preview.introduction}</p><ol>{preview.pillars.map((pillar, index) => <li key={pillar.title}><strong>{index + 1}. {pillar.title}</strong><p>{pillar.description}</p></li>)}</ol></details>
        <p className="mandala-note"><Check size={17} aria-hidden="true" /><span>Seu primeiro passo está liberado. As demais ações fazem parte do plano completo.</span></p>
      </section>

      <section className="conversion-first-step" aria-labelledby="conversion-step-title">
        <span className="begin-eyebrow"><Sprout size={15} /> COMECE POR AQUI</span>
        <h2 id="conversion-step-title">{preview.firstStep.title}</h2>
        <p>{preview.firstStep.description}</p>
        <span className="conversion-duration"><Clock3 size={14} /> Cerca de {preview.firstStep.minutes} minutos</span>
        <div className="conversion-checklist">
          {preview.firstStep.checklist.map((item,index) => <ChecklistItem key={item} text={item} checked={checked[index]} onToggle={() => onCheck(index)} />)}
        </div>
        <small>{checked.filter(Boolean).length} de 3 pequenas ações concluídas</small>
        {checked.every(Boolean) && <div className="preview-reward" role="status"><strong>Primeiro passo concluído.</strong><p>Seu Mandalart completo mostra como continuar. O que você marcou aqui acompanha seu plano.</p><button className="begin-primary" onClick={onCheckout} disabled={checkoutBusy}>{localKiwifyDemo ? `Simular compra de ${priceLabel}` : `Liberar ${bumpSelected ? '3 Mandalarts · R$99' : 'meu Mandalart completo · R$37'}`} <ArrowRight size={18} /></button></div>}
      </section>

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

      <section ref={offerRef} className="conversion-offer" aria-labelledby="conversion-offer-title">
        <span className="begin-eyebrow"><Sparkles size={15} /> CONTINUE O QUE COMEÇOU</span>
        <h2 id="conversion-offer-title">Seu próximo passo não precisa ficar no papel.</h2>
        <p>Desbloqueie os 8 caminhos do seu objetivo, com ações organizadas para você saber o que fazer e por onde continuar.</p>
        <p className="offer-features">8 caminhos · ações práticas · estrutura visual</p>
        <div className="conversion-price"><strong>{bumpSelected ? 'R$ 99' : 'R$ 37'}</strong><span>pagamento único<br />sem assinatura</span></div>
        <label className="conversion-bump"><input type="checkbox" checked={bumpSelected} disabled={checkoutBusy} onChange={event => onBumpChange(event.target.checked)} /><span className="conversion-bump-check" aria-hidden="true">{bumpSelected && <Check size={14} strokeWidth={3} />}</span><span><strong>Adicionar mais 2 Mandalarts por R$ 62</strong><small>Total R$ 99 para planejar 3 sonhos, sem assinatura.</small></span></label>
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
        <button className="begin-primary" onClick={onCheckout} disabled={checkoutBusy}>{checkoutBusy ? (localKiwifyDemo ? 'Preparando simulação…' : 'Preparando pagamento…') : paymentCta} <ArrowRight size={18} aria-hidden="true" /></button>
        {kiwifyCheckout && <small>{localKiwifyDemo ? 'Simulação local sem cobrança. Em produção, Pix ou cartão no checkout seguro da Kiwify.' : 'Pix ou cartão no checkout seguro da Kiwify.'}</small>}
        {localKiwifyDemo && kiwifyPreviewLinks && <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <a className="font-semibold underline" href={bumpSelected ? kiwifyPreviewLinks.three : kiwifyPreviewLinks.one} target="_blank" rel="noopener noreferrer">Ver o checkout real da Kiwify para {priceLabel}</a>
          <p className="mt-1">Esse link serve para conferir a página. Uma compra feita por ele não será vinculada ao seu pedido local.</p>
        </div>}
        <p className="conversion-guarantee"><ShieldCheck size={16} /> Pagamento único · Garantia de 7 dias</p>
        <small>Compre sem cadastro prévio. Depois do pagamento, você recebe um e-mail para criar sua senha e acessar seu plano.</small>
      </section>

      <section ref={emailRef} className="conversion-save" aria-labelledby="conversion-save-title">
        <div>
          <span className="begin-eyebrow"><Mail size={15} /> PARA VOLTAR DEPOIS</span>
          <h2 id="conversion-save-title">{localTest ? 'Teste o envio da prévia.' : 'Guarde esta prévia no seu e-mail.'}</h2>
          <p>{localTest ? 'Use qualquer e-mail válido. O envio será simulado no Resend, sem entregar à caixa de entrada.' : 'Seu primeiro caminho fica disponível para você retomar quando quiser.'}</p>
        </div>
        {emailSaved ? <p className="conversion-save-success" role="status"><Check size={17} /> {localTest ? 'Envio de teste aceito pelo Resend.' : 'Prévia salva. Enviamos o link para seu e-mail.'}</p> : <form onSubmit={onEmailSubmit}>
          <label htmlFor="lead-email">Seu e-mail</label>
          <div className="conversion-save-row">
            <input id="lead-email" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={email} onChange={event => onEmailChange(event.target.value)} placeholder="voce@exemplo.com" />
            <button type="submit" disabled={emailBusy || !email.trim()}>{emailBusy ? 'Enviando…' : 'Enviar prévia'}</button>
          </div>
          {emailError && <p role="alert" className="begin-error">{emailError}</p>}
          <small>{localTest ? 'O resultado aparece no painel do Resend. No local, lembretes automáticos ficam desativados.' : 'Opcional. Você receberá esta prévia e até dois lembretes. Pode cancelar pelos links nos e-mails.'}</small>
        </form>}
      </section>

      <div className="conversion-faq">
        <details><summary>O que recebo ao comprar?</summary><p>Um Mandalart completo para o sonho que você acabou de configurar, com oito caminhos, 64 tarefas e progresso salvo.</p></details>
        <details><summary>Por que não simplesmente pedir um plano para uma IA?</summary><p>Você pode criar um plano em um chat. O Mandalart entrega uma estrutura pronta para usar: oito caminhos, ações com checklists, próximo passo e progresso salvo. Assim você não precisa organizar e manter tudo por conta própria.</p></details>
        <details><summary>Preciso criar uma senha?</summary><p>Você compra primeiro. Depois da confirmação, recebe um e-mail para concluir o cadastro com seu nome e uma senha. Nas próximas visitas, basta entrar com seu e-mail e senha. Se já tem uma conta, use seu acesso habitual.</p></details>
        <details><summary>Posso pedir reembolso?</summary><p>Sim. Veja as condições em <Link href="/reembolso">nossa política de reembolso</Link>.</p></details>
      </div>
    </main>
    <div className="conversion-sticky"><span><strong>{bumpSelected ? '3 Mandalarts completos' : 'Seu Mandalart completo'}</strong><small>{priceLabel} · pagamento único</small></span><button onClick={onCheckout} disabled={checkoutBusy}>{localKiwifyDemo ? `Simular ${priceLabel}` : `Pagar ${priceLabel}`} <ArrowRight size={16} /></button></div>
  </>
}
