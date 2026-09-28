'use client'

import Link from 'next/link'
import { ArrowRight, Check, Clock3, LockKeyhole, Mail, PencilLine, ShieldCheck, Sparkles, Sprout } from 'lucide-react'
import type { FormEvent } from 'react'
import { getDream, previewHeading, type OnboardingAnswers, type OnboardingPreview } from '@/lib/onboarding'

type Props = {
  preview: OnboardingPreview
  answers: OnboardingAnswers
  checked: boolean[]
  onCheck: (index: number) => void
  onEdit: () => void
  onCheckout: () => void
  checkoutBusy: boolean
  checkoutError: string
  email: string
  onEmailChange: (email: string) => void
  onEmailSubmit: (event: FormEvent) => void
  emailBusy: boolean
  emailSaved: boolean
  emailError: string
}

export function Preview({ preview, answers, checked, onCheck, onEdit, onCheckout, checkoutBusy, checkoutError, email, onEmailChange, onEmailSubmit, emailBusy, emailSaved, emailError }: Props) {
  const dream = getDream(answers)
  const localTest = process.env.NODE_ENV === 'development'
  return <>
    <main id="begin-main" className="conversion-preview begin-enter">
      <header className="conversion-hero">
        <span className="begin-eyebrow"><Sparkles size={15} /> SUA PRÉVIA PERSONALIZADA</span>
        <h1 tabIndex={-1} data-step-heading>{previewHeading(preview.title)}.</h1>
        <p>{preview.introduction}</p>
        <button className="text-button" onClick={onEdit}><PencilLine size={14} /> Ajustar respostas</button>
      </header>

      <section className="mandala-reveal" aria-label="Seu Mandalart começando a tomar forma">
        <div className="reveal-intro">
          <span className="begin-eyebrow">SEU MANDALART</span>
          <h2>Seu sonho já tem um mapa.</h2>
          <p>O primeiro caminho está aberto. Os outros sete ganham ações no plano completo.</p>
        </div>
        <div className="mandala-grid" role="group" aria-label="Oito caminhos ao redor do seu sonho">
          {[0,1,2,7,-1,3,6,5,4].map(index => index === -1
            ? <div className="mandala-center" key="center"><span>SEU SONHO</span><strong>{dream}</strong></div>
            : <div className={`mandala-cell ${index === 0 ? 'is-open' : 'is-locked'}`} key={index} aria-label={`Caminho ${index + 1}: ${preview.pillars[index].title}${index ? ', ações disponíveis no plano completo' : ', aberto'}`}>
                <span>{index === 0 ? <Sprout size={14} /> : <LockKeyhole size={12} />} CAMINHO {index + 1}</span>
                <strong>{preview.pillars[index].title}</strong>
              </div>)}
        </div>
        <p className="mandala-note"><Check size={17} /> Seu primeiro caminho já está definido.</p>
      </section>

      <section className="conversion-first-step" aria-labelledby="conversion-step-title">
        <span className="begin-eyebrow"><Sprout size={15} /> COMECE POR AQUI</span>
        <h2 id="conversion-step-title">{preview.firstStep.title}</h2>
        <p>{preview.firstStep.description}</p>
        <span className="conversion-duration"><Clock3 size={14} /> Cerca de {preview.firstStep.minutes} minutos</span>
        <div className="conversion-checklist">
          {preview.firstStep.checklist.map((item,index) => <label key={item} className={checked[index] ? 'checked' : ''}>
            <input type="checkbox" checked={checked[index]} onChange={() => onCheck(index)} />
            <span><Check size={14} /></span>
            <span>{item}</span>
          </label>)}
        </div>
        <small>{checked.filter(Boolean).length} de 3 pequenas ações concluídas</small>
      </section>

      <section className="conversion-offer" aria-labelledby="conversion-offer-title">
        <span className="begin-eyebrow"><Sparkles size={15} /> CONTINUE O QUE COMEÇOU</span>
        <h2 id="conversion-offer-title">Veja seu Mandalart inteiro.</h2>
        <p>Receba os oito caminhos com 64 tarefas e checklists, organizados para você seguir no seu ritmo. O primeiro passo que você acabou de ver faz parte do plano.</p>
        <div className="conversion-price"><strong>R$ 37</strong><span>pagamento único<br />sem assinatura</span></div>
        {checkoutError && <p role="alert" className="begin-error">{checkoutError}</p>}
        <button className="begin-primary" onClick={onCheckout} disabled={checkoutBusy}>{checkoutBusy ? 'Abrindo pagamento…' : 'Liberar meu Mandalart completo · R$37'} <ArrowRight size={18} /></button>
        <p className="conversion-guarantee"><ShieldCheck size={16} /> Pagamento único · Garantia de 7 dias</p>
        <small>Sem cadastro. O e-mail para receber seu acesso é solicitado no pagamento seguro da Stripe.</small>
      </section>

      <section className="conversion-save" aria-labelledby="conversion-save-title">
        <div>
          <span className="begin-eyebrow"><Mail size={15} /> PARA VOLTAR DEPOIS</span>
          <h2 id="conversion-save-title">{localTest ? 'Teste o envio da prévia.' : 'Guarde esta prévia no seu e-mail.'}</h2>
          <p>{localTest ? 'Use um endereço de teste do Resend. Nenhuma pessoa receberá a mensagem.' : 'Seu primeiro caminho fica disponível para você retomar quando quiser.'}</p>
        </div>
        {emailSaved ? <p className="conversion-save-success" role="status"><Check size={17} /> {localTest ? 'Envio de teste aceito pelo Resend.' : 'Prévia salva. Enviamos o link para seu e-mail.'}</p> : <form onSubmit={onEmailSubmit}>
          <label htmlFor="lead-email">Seu e-mail</label>
          <div className="conversion-save-row">
            <input id="lead-email" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={email} onChange={event => onEmailChange(event.target.value)} placeholder={localTest ? 'delivered@resend.dev' : 'voce@exemplo.com'} />
            <button type="submit" disabled={emailBusy || !email.trim()}>{emailBusy ? 'Enviando…' : 'Enviar prévia'}</button>
          </div>
          {emailError && <p role="alert" className="begin-error">{emailError}</p>}
          <small>{localTest ? 'O resultado aparece no painel do Resend. No local, lembretes automáticos ficam desativados.' : 'Opcional. Você receberá esta prévia e até dois lembretes. Pode cancelar pelos links nos e-mails.'}</small>
        </form>}
      </section>

      <div className="conversion-faq">
        <details><summary>O que recebo ao comprar?</summary><p>Um Mandalart completo para o sonho que você acabou de configurar, com oito caminhos, 64 tarefas e progresso salvo.</p></details>
        <details><summary>Preciso criar uma senha?</summary><p>Não para pagar. Após a confirmação, enviamos um link de acesso ao e-mail informado. Você poderá abrir seu plano neste ou em outro aparelho.</p></details>
        <details><summary>Posso pedir reembolso?</summary><p>Sim. Veja as condições em <Link href="/reembolso">nossa política de reembolso</Link>.</p></details>
      </div>
    </main>
    <div className="conversion-sticky"><span><strong>Seu Mandalart completo</strong><small>R$37 · pagamento único</small></span><button onClick={onCheckout} disabled={checkoutBusy}>Liberar agora <ArrowRight size={16} /></button></div>
  </>
}
