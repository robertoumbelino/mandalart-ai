'use client'

import React, { useEffect, useRef } from 'react'
import { ArrowLeft, HandHeart, ShieldBan } from 'lucide-react'
import type { GoalSafetyCategory } from '@/types'

interface SafetyNoticeProps {
  category: GoalSafetyCategory
  onBack: () => void
}

export const SafetyNotice: React.FC<SafetyNoticeProps> = ({ category, onBack }) => {
  const isSelfHarm = category === 'self-harm'
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [category])

  return (
    <section
      aria-labelledby="safety-notice-title"
      className="relative isolate w-full max-w-6xl overflow-hidden px-2 pb-12 pt-28 sm:px-6 sm:pt-32 lg:pt-24"
    >
      <div
        aria-hidden="true"
        className={`absolute left-[8%] top-28 -z-10 h-12 w-12 rounded-full bg-gradient-to-br from-white shadow-xl ring-1 ring-white/90 sm:h-16 sm:w-16 ${
          isSelfHarm ? 'to-indigo-200 shadow-indigo-200/70' : 'to-rose-100 shadow-rose-100/70'
        }`}
      />
      <div
        aria-hidden="true"
        className={`absolute right-[8%] top-32 -z-10 h-16 w-16 rounded-full bg-gradient-to-br from-white shadow-xl ring-1 ring-white/90 sm:h-20 sm:w-20 ${
          isSelfHarm ? 'to-violet-300 shadow-violet-200/80' : 'to-indigo-200 shadow-indigo-200/70'
        }`}
      />

      <div className="grid min-h-[34rem] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.82fr)] lg:gap-16">
        <div className="mx-auto w-full max-w-xl lg:mx-0">
          <p className={`text-xs font-black uppercase tracking-[0.18em] sm:text-sm ${
            isSelfHarm ? 'text-indigo-600' : 'text-red-500'
          }`}>
            {isSelfHarm ? 'Você importa' : 'Objetivo não permitido'}
          </p>

          <h1
            ref={titleRef}
            id="safety-notice-title"
            tabIndex={-1}
            className="mt-6 text-4xl font-black leading-[0.98] tracking-[-0.045em] text-slate-950 outline-none sm:text-6xl"
          >
            {isSelfHarm
              ? 'Vamos cuidar de você primeiro.'
              : 'Esse objetivo não pode virar um plano.'}
          </h1>

          {isSelfHarm ? (
            <>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
                Sinto muito que você esteja passando por isso. Seu plano pode esperar.
                Agora, procure alguém de confiança e não fique sozinho.
              </p>
              <p className="mt-4 max-w-lg text-base font-semibold leading-relaxed text-slate-700 sm:text-lg">
                Risco imediato: SAMU{' '}
                <a className="font-black text-slate-950 hover:underline" href="tel:192">192</a>.
                {' '}Apoio emocional: CVV{' '}
                <a className="font-black text-slate-950 hover:underline" href="tel:188">188</a>,
                grátis, 24 horas.
              </p>
            </>
          ) : (
            <p className="mt-6 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
              O Mandalart.AI não cria planos para atividades ilegais, violência ou
              ações que possam prejudicar outras pessoas. Tente novamente com um
              objetivo seguro e dentro da lei.
            </p>
          )}

          <button
            type="button"
            onClick={onBack}
            className="mt-8 inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-slate-950 px-7 text-base font-bold text-white shadow-lg shadow-slate-300/60 transition hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:text-lg"
          >
            <ArrowLeft size={22} />
            {isSelfHarm ? 'Voltar ao início' : 'Voltar e reformular'}
          </button>
        </div>

        <div
          aria-hidden="true"
          className="relative mx-auto grid aspect-square w-full max-w-[21rem] grid-cols-2 gap-1.5 sm:max-w-[23rem]"
        >
          {[0, 1, 2, 3].map(tile => (
            <div
              key={tile}
              className={`rounded-[1.75rem] border-2 bg-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_50px_rgba(99,102,241,0.08)] backdrop-blur-sm ${
                isSelfHarm
                  ? 'border-indigo-200/90 shadow-indigo-200/30'
                  : 'border-rose-200/90 shadow-rose-200/30'
              }`}
            />
          ))}

          <div className={`absolute inset-0 m-auto grid h-36 w-36 place-items-center rounded-[2.25rem] text-white shadow-2xl sm:h-40 sm:w-40 ${
            isSelfHarm
              ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-violet-400/45'
              : 'bg-gradient-to-br from-red-400 to-red-500 shadow-red-400/45'
          }`}>
            {isSelfHarm
              ? <HandHeart size={84} strokeWidth={1.8} />
              : <ShieldBan size={86} strokeWidth={1.8} />}
          </div>
        </div>
      </div>
    </section>
  )
}
