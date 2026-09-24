'use client'

import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Heart,
  Image as ImageIcon,
  Layers3,
  LockKeyhole,
  Map,
  PencilLine,
  Sparkles,
  Sprout
} from 'lucide-react'
import {
  CATEGORIES,
  HORIZONS,
  TIME_OPTIONS,
  type OnboardingAnswers,
  type OnboardingPreview
} from '@/lib/onboarding'
import { DreamIcon } from './Visuals'

type Props = {
  preview: OnboardingPreview
  answers: OnboardingAnswers
  checked: boolean[]
  pack: 1 | 3
  onCheck: (index: number) => void
  onEdit: () => void
  onPack: (pack: 1 | 3) => void
  onCheckout: () => void
}

export function Preview({
  preview,
  answers,
  checked,
  pack,
  onCheck,
  onEdit,
  onPack,
  onCheckout
}: Props) {
  const done = checked.filter(Boolean).length
  const category = CATEGORIES.find((item) => item.id === answers.category)!
  return (
    <>
      <main id="begin-main" className="preview-page begin-enter">
        <header className="preview-heading">
          <span className="begin-eyebrow">
            <span className="live-dot" /> SUA PRÉVIA ESTÁ PRONTA
          </span>
          <h1 tabIndex={-1} data-step-heading>
            Um caminho para
            <br />
            <em>
              {preview.title.charAt(0).toLowerCase() + preview.title.slice(1)}.
            </em>
          </h1>
          <p>{preview.introduction}</p>
          <div className="context-chips">
            <span>
              <Clock3 size={14} />
              {TIME_OPTIONS.find((item) => item.id === answers.time)?.title}
            </span>
            <span>
              <Sprout size={14} />
              {HORIZONS.find((item) => item.id === answers.horizon)?.title}
            </span>
          </div>
          <button className="text-button" onClick={onEdit}>
            <PencilLine size={14} /> Ajustar minhas respostas
          </button>
        </header>

        <section
          className={`first-step-card ${done === 3 ? 'first-step-done' : ''}`}
          aria-labelledby="first-step-title"
        >
          <div className="first-step-top">
            <span className="begin-eyebrow">
              <Sprout size={16} /> SEU PRIMEIRO PASSO
            </span>
            <span className="time-pill">
              <Clock3 size={13} /> Cerca de {preview.firstStep.minutes} min
            </span>
          </div>
          <h2 id="first-step-title">{preview.firstStep.title}</h2>
          <p>{preview.firstStep.description}</p>
          <div className="preview-checklist">
            {preview.firstStep.checklist.map((item, index) => (
              <label className={checked[index] ? 'is-checked' : ''} key={item}>
                <input
                  type="checkbox"
                  checked={checked[index]}
                  onChange={() => onCheck(index)}
                />
                <span className="custom-check" aria-hidden="true">
                  {checked[index] && <Check size={15} strokeWidth={2.5} />}
                </span>
                <span>{item}</span>
              </label>
            ))}
          </div>
          <div className="first-step-bottom">
            <p aria-live="polite">
              {done === 3 ? (
                <>
                  <Heart size={15} /> Você deu o primeiro passo. Guarde esse
                  momento.
                </>
              ) : (
                <>
                  <span className="mini-progress">
                    <span style={{ width: `${(done / 3) * 100}%` }} />
                  </span>
                  {done} de 3 ações concluídas
                </>
              )}
            </p>
            <span>Prévia gratuita</span>
          </div>
        </section>

        <section className="pillars-section" aria-labelledby="pillars-title">
          <div className="section-intro">
            <div>
              <span className="begin-eyebrow">
                O SEU SONHO, EM PARTES POSSÍVEIS
              </span>
              <h2 id="pillars-title">Olha o caminho que começa aqui.</h2>
            </div>
            <span className={`category-medallion tone-${category.id}`}>
              <DreamIcon name={category.icon} size={25} />
            </span>
          </div>
          <p className="section-description">
            Estes são os 8 pilares do seu plano. No planner completo, cada um se
            desdobra em ações para você seguir no seu ritmo.
          </p>
          <div className="pillars-grid">
            {preview.pillars.map((pillar, index) => (
              <details key={pillar.title} className={`pillar pillar-${index}`}>
                <summary>
                  <span className="pillar-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{pillar.title}</span>
                  <ChevronDown size={16} />
                </summary>
                <p>{pillar.description}</p>
              </details>
            ))}
          </div>
          <div className="path-continuation">
            <span />
            <LockKeyhole size={15} />
            <p>As próximas tarefas fazem parte do planner completo.</p>
            <span />
          </div>
          <button
            className="text-button explore-offer"
            onClick={() =>
              document
                .getElementById('seu-planner')
                ?.scrollIntoView({
                  behavior: window.matchMedia(
                    '(prefers-reduced-motion: reduce)'
                  ).matches
                    ? 'instant'
                    : 'smooth'
                })
            }
          >
            Conhecer o planner completo <ArrowDown size={15} />
          </button>
        </section>

        <section
          id="seu-planner"
          className="offer-section"
          aria-labelledby="offer-title"
        >
          <div className="offer-copy">
            <span className="begin-eyebrow">
              <Sparkles size={14} /> DÊ ESPAÇO A ESSE SONHO
            </span>
            <h2 id="offer-title">
              O primeiro passo é seu.
              <br />
              <em>O caminho pode continuar.</em>
            </h2>
            <p>
              Um lugar para organizar o que importa, saber o que fazer agora e
              enxergar o quanto você já caminhou.
            </p>
          </div>
          <div className="offer-content">
            <ul className="feature-list">
              <li>
                <Layers3 size={20} />
                <span>
                  <strong>Seu sonho, bem organizado</strong>
                  <small>
                    8 pilares e 64 tarefas com orientações e checklists.
                  </small>
                </span>
              </li>
              <li>
                <Map size={20} />
                <span>
                  <strong>Clareza para o próximo passo</strong>
                  <small>
                    Uma jornada com sequência sugerida, no seu ritmo.
                  </small>
                </span>
              </li>
              <li>
                <Check size={20} />
                <span>
                  <strong>Cada avanço tem seu lugar</strong>
                  <small>Progresso salvo para você continuar depois.</small>
                </span>
              </li>
              <li>
                <ImageIcon size={20} />
                <span>
                  <strong>Um mapa para ter por perto</strong>
                  <small>
                    Veja seu Mandalart e salve a matriz como imagem.
                  </small>
                </span>
              </li>
            </ul>
            <div className="purchase-card">
              <span className="coming-soon-tag">SEU PRÓXIMO PASSO</span>
              <h3>Quantos sonhos você quer cultivar?</h3>
              <fieldset className="pack-options">
                <legend className="sr-only">
                  Escolha seu pacote de sonhos
                </legend>
                <label className={pack === 1 ? 'pack selected' : 'pack'}>
                  <input
                    type="radio"
                    name="pack"
                    value="1"
                    checked={pack === 1}
                    onChange={() => onPack(1)}
                  />
                  <span className="pack-radio" aria-hidden="true">
                    {pack === 1 && <span />}
                  </span>
                  <span>
                    <strong>1 sonho · R$ 39,90</strong>
                    <small>Um planner para o seu objetivo de agora.</small>
                  </span>
                  <Sprout size={22} />
                </label>
                <label className={pack === 3 ? 'pack selected' : 'pack'}>
                  <input
                    type="radio"
                    name="pack"
                    value="3"
                    checked={pack === 3}
                    onChange={() => onPack(3)}
                  />
                  <span className="pack-radio" aria-hidden="true">
                    {pack === 3 && <span />}
                  </span>
                  <span>
                    <strong>3 sonhos · R$ 99,90</strong>
                    <small>Economize R$ 19,80. Use os sonhos no seu ritmo.</small>
                  </span>
                  <Layers3 size={22} />
                </label>
              </fieldset>
              <p className="purchase-explainer">
                Pagamento único, sem assinatura.
                <br />
                Cada novo planner usa um sonho.
              </p>
              <button className="begin-primary offer-cta" onClick={onCheckout}>
                {pack === 1
                  ? 'Liberar meu plano completo'
                  : 'Escolher meus 3 sonhos'}
                <ArrowRight size={18} />
              </button>
              <p className="checkout-unavailable">
                <LockKeyhole size={12} /> Seus créditos ficam na sua conta
              </p>
            </div>
          </div>
        </section>

        <section className="faq-section" aria-labelledby="faq-title">
          <span className="begin-eyebrow">COMBINADO É COMBINADO</span>
          <h2 id="faq-title">Para começar com tranquilidade.</h2>
          <details>
            <summary>
              O que significa comprar um sonho?
              <ChevronDown size={18} />
            </summary>
            <p>
              Um sonho corresponde a um planner completo para um objetivo, com 8
              pilares, 64 tarefas e checklists. No pacote de 3 sonhos, você terá
              este planner e mais 2 objetivos para planejar depois.
            </p>
          </details>
          <details>
            <summary>
              Vou pagar uma assinatura?
              <ChevronDown size={18} />
            </summary>
            <p>
              Não. Você paga uma vez pelo pacote escolhido. Consultar
              seu planner e marcar seu progresso não consome novos sonhos.
            </p>
          </details>
          <details>
            <summary>
              Preciso fazer tudo de uma vez?
              <ChevronDown size={18} />
            </summary>
            <p>
              Não. A jornada sugere uma ordem e destaca um próximo passo. Você
              pode explorar os pilares e avançar no seu ritmo. O planner ajuda a
              organizar o caminho; os resultados dependem das ações e das
              condições de cada pessoa.
            </p>
          </details>
          <details>
            <summary>
              Posso guardar esta prévia?
              <ChevronDown size={18} />
            </summary>
            <p>
              Sim. Suas respostas e as ações marcadas ficam guardadas neste
              navegador por até 7 dias, se o armazenamento estiver disponível.
              Volte ao mesmo endereço e navegador para continuar. Nesta etapa,
              ainda não há sincronização entre aparelhos.
            </p>
          </details>
        </section>
        <div className="preview-signoff">
          <Sprout size={25} strokeWidth={1.4} />
          <p>Grandes mudanças também começam devagar.</p>
          <span>Que bom que você começou.</span>
        </div>
      </main>
      <div className="preview-bottom-bar">
        <span>
          <strong>
            {pack === 1 ? 'Seu próximo capítulo' : 'Espaço para 3 sonhos'}
          </strong>
          <small>{pack === 1 ? 'R$ 39,90 · pagamento único' : 'R$ 99,90 · pagamento único'}</small>
        </span>
        <button onClick={onCheckout}>
          Quero continuar <ArrowRight size={16} />
        </button>
      </div>
    </>
  )
}
