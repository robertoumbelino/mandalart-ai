'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Flag,
  Footprints,
  Map,
  Play,
  Sparkles,
  Target,
  Trophy
} from 'lucide-react'
import type { MandalartData } from '@/types'
import { getJourneyProgress } from '@/lib/journey'

interface JourneyViewProps {
  data: MandalartData
  onBack: () => void
  onSelectTask: (subGoalIndex: number, taskIndex: number) => void
}

const STAGE_THEMES = [
  { soft: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500', ring: 'ring-violet-100' },
  { soft: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', ring: 'ring-blue-100' },
  { soft: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500', ring: 'ring-cyan-100' },
  { soft: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-100' },
  { soft: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', ring: 'ring-amber-100' },
  { soft: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', ring: 'ring-orange-100' },
  { soft: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', ring: 'ring-rose-100' },
  { soft: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200', dot: 'bg-fuchsia-500', ring: 'ring-fuchsia-100' }
] as const

export const JourneyView: React.FC<JourneyViewProps> = ({
  data,
  onBack,
  onSelectTask
}) => {
  const progress = getJourneyProgress(data)
  const [openStages, setOpenStages] = useState<Set<number>>(
    () => new Set([progress.currentStageIndex])
  )
  const chapterNavRef = useRef<HTMLElement>(null)
  const [chapterScroll, setChapterScroll] = useState({ left: false, right: true })

  useEffect(() => {
    const chapterNav = chapterNavRef.current
    if (!chapterNav) return

    const updateScrollControls = () => {
      const remainingScroll = chapterNav.scrollWidth - chapterNav.clientWidth - chapterNav.scrollLeft
      setChapterScroll({
        left: chapterNav.scrollLeft > 4,
        right: remainingScroll > 4
      })
    }
    const initialFrame = window.requestAnimationFrame(updateScrollControls)
    const resizeObserver = new ResizeObserver(updateScrollControls)

    chapterNav.addEventListener('scroll', updateScrollControls, { passive: true })
    resizeObserver.observe(chapterNav)

    return () => {
      window.cancelAnimationFrame(initialFrame)
      chapterNav.removeEventListener('scroll', updateScrollControls)
      resizeObserver.disconnect()
    }
  }, [])

  const toggleStage = (stageIndex: number) => {
    setOpenStages(current => {
      const next = new Set(current)
      if (next.has(stageIndex)) next.delete(stageIndex)
      else next.add(stageIndex)
      return next
    })
  }

  const goToStage = (stageIndex: number) => {
    setOpenStages(current => new Set(current).add(stageIndex))
    window.requestAnimationFrame(() => {
      document.getElementById(`journey-stage-${stageIndex}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    })
  }

  const scrollChapters = (direction: -1 | 1) => {
    const chapterNav = chapterNavRef.current
    if (!chapterNav) return

    chapterNav.scrollBy({
      left: direction * Math.max(chapterNav.clientWidth * 0.68, 280),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    })
  }

  const nextTask = progress.nextTask
  const nextTaskChecked = nextTask?.task.checklist.filter(item => item.checked).length ?? 0

  return (
    <div className="journey-screen w-full min-h-screen pb-24">
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-8 pt-4 sm:pt-7">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 text-sm font-bold text-slate-600 shadow-sm backdrop-blur transition hover:border-indigo-200 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <ArrowLeft size={17} />
          Voltar para a matriz
        </button>

        <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
              <Map size={14} /> Sua jornada
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.04em] text-slate-950 sm:text-6xl">
              {data.mainGoal}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500 sm:text-lg">
              Um passo de cada vez. A ordem abaixo foi pensada para reduzir atrito e transformar seu plano em avanço real.
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-3xl border border-white bg-white/75 p-4 pr-6 shadow-sm backdrop-blur">
            <div
              className="journey-progress-ring grid h-20 w-20 shrink-0 place-items-center rounded-full"
              style={{
                background: `conic-gradient(#4f46e5 ${progress.percentage}%, #e2e8f0 ${progress.percentage}% 100%)`
              }}
              role="progressbar"
              aria-label="Progresso geral da jornada"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress.percentage}
            >
              <div className="grid h-[62px] w-[62px] place-items-center rounded-full bg-white text-lg font-black text-slate-900">
                {progress.percentage}%
              </div>
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Progresso geral</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {progress.completedItems} de {progress.totalItems} ações feitas
              </p>
              <p className="text-xs text-slate-400">
                {progress.completedTasks} de {progress.totalTasks} etapas concluídas
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 sm:px-8">
        <section className="journey-focus relative mt-10 overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-7 text-white shadow-2xl shadow-indigo-950/15 sm:px-9 sm:py-9">
          <div className="journey-focus-orbit" aria-hidden="true" />
          {nextTask ? (
            <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="max-w-2xl">
                <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                  <Sparkles size={15} /> Seu foco agora
                </div>
                <div className="flex items-start gap-4">
                  <div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-violet-200 sm:grid">
                    <Target size={23} />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold text-slate-400">
                      Capítulo {nextTask.subGoalIndex + 1} · Etapa {nextTask.stepNumber} de {progress.totalTasks}
                    </p>
                    <h2 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                      {nextTask.task.title}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                      {nextTask.task.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative z-10 min-w-56">
                <p className="mb-3 text-xs font-semibold text-slate-400">
                  {nextTaskChecked} de {nextTask.task.checklist.length} ações desta etapa
                </p>
                <button
                  type="button"
                  onClick={() => onSelectTask(nextTask.subGoalIndex, nextTask.taskIndex)}
                  className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white px-6 text-sm font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {nextTaskChecked > 0 ? <Play size={18} fill="currentColor" /> : <Footprints size={19} />}
                  {nextTaskChecked > 0 ? 'Continuar esta etapa' : 'Começar esta etapa'}
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          ) : (
            <div className="relative z-10 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/20">
                <Trophy size={31} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Objetivo concluído</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">Você completou toda a jornada.</h2>
                <p className="mt-2 text-slate-300">Todas as 64 etapas e 192 ações foram concluídas. Este mapa agora é a história do caminho que você percorreu.</p>
              </div>
            </div>
          )}
        </section>

        <div className="relative mt-8">
          {chapterScroll.left && (
            <>
              <span className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent" aria-hidden="true" />
              <button
                type="button"
                onClick={() => scrollChapters(-1)}
                aria-label="Ver capítulos anteriores"
                className="absolute left-1 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:-translate-x-0.5 hover:border-indigo-200 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <ChevronLeft size={21} />
              </button>
            </>
          )}

          <nav
            ref={chapterNavRef}
            aria-label="Capítulos da jornada"
            className="journey-chapter-scroller overflow-x-auto px-2 pb-2"
          >
            <ol className="flex min-w-max items-center">
              {data.subGoals.map((subGoal, stageIndex) => {
                const stage = progress.stages[stageIndex]
                const isComplete = stage.completedTasks === stage.totalTasks
                const isCurrent = !isComplete && stageIndex === progress.currentStageIndex

                return (
                  <li key={stageIndex} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => goToStage(stageIndex)}
                      aria-label={`Abrir capítulo ${stageIndex + 1}: ${subGoal.title}`}
                      title={subGoal.title}
                      className={`group flex flex-col items-center gap-2 rounded-2xl px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isCurrent ? 'text-indigo-700' : 'text-slate-400'}`}
                    >
                      <span className={`grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-black transition ${
                        isComplete
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : isCurrent
                            ? 'border-indigo-600 bg-indigo-600 text-white ring-4 ring-indigo-100'
                            : 'border-slate-200 bg-white text-slate-400 group-hover:border-indigo-300 group-hover:text-indigo-600'
                      }`}>
                        {isComplete ? <Check size={16} strokeWidth={3} /> : stageIndex + 1}
                      </span>
                      <span className="min-h-9 w-32 text-center text-xs font-bold leading-tight line-clamp-3">{subGoal.title}</span>
                    </button>
                    {stageIndex < data.subGoals.length - 1 && (
                      <span className={`mb-5 h-0.5 w-7 sm:w-12 ${isComplete ? 'bg-emerald-300' : 'bg-slate-200'}`} aria-hidden="true" />
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>

          {chapterScroll.right && (
            <>
              <span className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent" aria-hidden="true" />
              <button
                type="button"
                onClick={() => scrollChapters(1)}
                aria-label="Ver próximos capítulos"
                className="absolute right-1 top-3 z-20 grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition hover:translate-x-0.5 hover:border-indigo-200 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <ChevronRight size={21} />
              </button>
            </>
          )}
        </div>

        <section className="mt-10" aria-labelledby="route-title">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-600">Rota completa</p>
              <h2 id="route-title" className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Do primeiro passo à conquista</h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">Abra qualquer capítulo para explorar. A rota recomenda uma ordem, mas continua sendo sua.</p>
          </div>

          <div className="space-y-4">
            {data.subGoals.map((subGoal, stageIndex) => {
              const theme = STAGE_THEMES[stageIndex]
              const stage = progress.stages[stageIndex]
              const isOpen = openStages.has(stageIndex)
              const isComplete = stage.completedTasks === stage.totalTasks
              const isCurrent = !isComplete && stageIndex === progress.currentStageIndex

              return (
                <article
                  id={`journey-stage-${stageIndex}`}
                  key={stageIndex}
                  className={`scroll-mt-24 overflow-hidden rounded-[1.75rem] border bg-white/90 shadow-sm backdrop-blur transition ${
                    isCurrent ? `${theme.border} ring-4 ${theme.ring}` : 'border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleStage(stageIndex)}
                    aria-expanded={isOpen}
                    className="flex min-h-24 w-full items-center gap-4 px-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:px-7"
                  >
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-black ${isComplete ? 'bg-emerald-500 text-white' : `${theme.soft} ${theme.text}`}`}>
                      {isComplete ? <CheckCircle2 size={23} /> : String(stageIndex + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-black leading-tight text-slate-900 sm:text-xl">{subGoal.title}</span>
                        {isCurrent && <span className={`rounded-full ${theme.soft} px-2 py-1 text-[10px] font-black uppercase tracking-wider ${theme.text}`}>Você está aqui</span>}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">{stage.completedTasks} de {stage.totalTasks} etapas · {stage.percentage}% concluído</span>
                    </span>
                    <span className="hidden w-32 sm:block">
                      <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <span className={`block h-full rounded-full ${isComplete ? 'bg-emerald-500' : theme.dot}`} style={{ width: `${stage.percentage}%` }} />
                      </span>
                    </span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 pb-7 pt-6 sm:px-7">
                      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-slate-500">{subGoal.description}</p>
                      <ol className="journey-task-list">
                        {subGoal.tasks.map((task, taskIndex) => {
                          const checkedCount = task.checklist.filter(item => item.checked).length
                          const isTaskComplete = task.isCompleted || checkedCount === task.checklist.length
                          const isTaskCurrent = nextTask?.subGoalIndex === stageIndex && nextTask.taskIndex === taskIndex
                          const globalStep = stageIndex * subGoal.tasks.length + taskIndex + 1

                          return (
                            <li key={taskIndex} className="journey-task-item relative pl-11 sm:pl-14">
                              <span className={`absolute left-0 top-4 z-10 grid h-8 w-8 place-items-center rounded-full border-2 bg-white text-[10px] font-black sm:h-9 sm:w-9 ${
                                isTaskComplete
                                  ? 'border-emerald-500 bg-emerald-500 text-white'
                                  : isTaskCurrent
                                    ? `${theme.border} ${theme.text} ring-4 ${theme.ring}`
                                    : 'border-slate-200 text-slate-400'
                              }`}>
                                {isTaskComplete ? <Check size={15} strokeWidth={3} /> : globalStep}
                              </span>
                              <button
                                type="button"
                                onClick={() => onSelectTask(stageIndex, taskIndex)}
                                className={`group mb-3 flex min-h-16 w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                  isTaskCurrent
                                    ? `${theme.border} ${theme.soft}`
                                    : isTaskComplete
                                      ? 'border-emerald-100 bg-emerald-50/50'
                                      : 'border-slate-100 bg-white hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md'
                                }`}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className={`block text-sm font-bold leading-snug ${isTaskComplete ? 'text-emerald-800' : 'text-slate-800'}`}>{task.title}</span>
                                  <span className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                                    {isTaskCurrent && <span className={`font-black uppercase tracking-wider ${theme.text}`}>Agora ·</span>}
                                    {checkedCount}/{task.checklist.length} ações
                                  </span>
                                </span>
                                <span className="flex gap-1" aria-label={`${checkedCount} de ${task.checklist.length} ações concluídas`}>
                                  {task.checklist.map(item => (
                                    item.checked
                                      ? <CheckCircle2 key={item.id} size={14} className="text-emerald-500" />
                                      : <Circle key={item.id} size={14} className="text-slate-200" />
                                  ))}
                                </span>
                                <ArrowRight size={17} className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-indigo-500" />
                              </button>
                            </li>
                          )
                        })}
                      </ol>
                      <div className={`mt-5 flex items-start gap-3 rounded-2xl ${theme.soft} px-4 py-3 text-sm leading-relaxed ${theme.text}`}>
                        <Flag size={17} className="mt-0.5 shrink-0" />
                        <p><strong>Dica do capítulo:</strong> {subGoal.advice}</p>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
