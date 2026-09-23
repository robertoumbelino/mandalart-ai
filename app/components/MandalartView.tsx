'use client'

import { BrandLogo } from './Brand';

import React, { useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas-pro'
import {
  Download,
  Loader2,
  RefreshCcw,
  X,
  Info,
  CheckCircle2,
  TrendingUp,
  Lightbulb,
  CheckSquare,
  ChevronDown,
  ArrowRight,
  Compass,
  Play,
  Sparkles
} from 'lucide-react'
import { MandalartData, Task } from '@/types'
import { GridCell } from '@/app/components/GridCell'
import { JourneyView } from '@/app/components/JourneyView'
import { getJourneyProgress } from '@/lib/journey'

interface MandalartViewProps {
  data: MandalartData
  onReset: () => void
  onDataUpdate: (newData: MandalartData) => void
}

export const MandalartView: React.FC<MandalartViewProps> = ({
  data,
  onReset,
  onDataUpdate
}) => {
  const printRef = useRef<HTMLDivElement>(null)
  const taskSheetRef = useRef<HTMLDivElement>(null)
  const closeSheetButtonRef = useRef<HTMLButtonElement>(null)
  const [selectedTask, setSelectedTask] = useState<{
    task: Task
    subGoalIndex: number
    taskIndex: number
  } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [viewMode, setViewMode] = useState<'matrix' | 'journey'>('matrix')
  const [openMobileAreaIndex, setOpenMobileAreaIndex] = useState<number | null>(
    null
  )

  const journeyProgress = getJourneyProgress(data)
  const isTaskSheetOpen = selectedTask !== null

  useEffect(() => {
    if (!isTaskSheetOpen) return

    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusFrame = window.requestAnimationFrame(() => closeSheetButtonRef.current?.focus())
    const handleSheetKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedTask(null)
        return
      }
      if (event.key !== 'Tab' || !taskSheetRef.current) return

      const focusable = Array.from(
        taskSheetRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleSheetKeys)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleSheetKeys)
      previouslyFocused?.focus()
    }
  }, [isTaskSheetOpen])

  useEffect(() => {
    if (openMobileAreaIndex === null) return

    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`mobile-area-${openMobileAreaIndex}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [openMobileAreaIndex])

  const handleDownload = async () => {
    if (!printRef.current || isExporting) return

    setIsExporting(true)
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: 1920,
        onclone: clonedDoc => {
          const wrapper = clonedDoc.getElementById('mandalart-print-area')
          const gridContainer = clonedDoc.getElementById(
            'mandalart-grid-container'
          )

          if (wrapper && gridContainer) {
            wrapper.style.width = '1600px'
            wrapper.style.height = 'auto'
            wrapper.style.padding = '60px'
            wrapper.style.boxShadow = 'none'
            wrapper.style.background = '#ffffff'

            gridContainer.style.width = '1400px'
            gridContainer.style.height = '1400px'
            gridContainer.style.maxWidth = 'none'
            gridContainer.style.maxHeight = 'none'

            const textSpans = gridContainer.querySelectorAll('span')
            textSpans.forEach((span: HTMLSpanElement) => {
              span.style.webkitLineClamp = 'unset'
              span.style.display = 'block'
              span.style.overflow = 'visible'
              span.style.fontSize = '12px'
              span.style.lineHeight = '1.3'
            })
          }
        }
      })

      const image = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      const goalSlug = data.mainGoal
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 80) || 'plano'

      link.href = image
      link.download = `mandalart-${goalSlug}.png`
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Export failed:', err)
      alert('Não foi possível gerar a imagem. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleToggleCheck = (checkItemId: string) => {
    if (!selectedTask) return

    const task = data.subGoals[selectedTask.subGoalIndex].tasks[selectedTask.taskIndex]
    const checklist = task.checklist.map(item =>
      item.id === checkItemId ? { ...item, checked: !item.checked } : item
    )
    const updatedTask = {
      ...task,
      checklist,
      isCompleted: checklist.every(item => item.checked)
    }
    const newData = {
      ...data,
      subGoals: data.subGoals.map((subGoal, subGoalIndex) =>
        subGoalIndex === selectedTask.subGoalIndex
          ? {
              ...subGoal,
              tasks: subGoal.tasks.map((currentTask, taskIndex) =>
                taskIndex === selectedTask.taskIndex ? updatedTask : currentTask
              )
            }
          : subGoal
      )
    }

    onDataUpdate(newData)
    setSelectedTask({ ...selectedTask, task: updatedTask })
  }

  const getZoneContentIndex = (zoneIndex: number): number | 'CENTER' => {
    if (zoneIndex === 4) return 'CENTER'
    return zoneIndex < 4 ? zoneIndex : zoneIndex - 1
  }

  const openMobileArea = (subGoalIndex: number) => {
    setOpenMobileAreaIndex(subGoalIndex)
  }

  const openTask = (subGoalIndex: number, taskIndex: number) => {
    setSelectedTask({
      task: data.subGoals[subGoalIndex].tasks[taskIndex],
      subGoalIndex,
      taskIndex
    })
  }

  const renderZone = (
    zoneIndex: number,
    onSubGoalClick?: (subGoalIndex: number) => void
  ) => {
    const contentIndex = getZoneContentIndex(zoneIndex)
    const isCenterZone = contentIndex === 'CENTER'

    const gridContainerClass =
      'grid grid-cols-3 grid-rows-3 w-full h-full gap-px bg-slate-200 border border-slate-200 overflow-hidden rounded-lg shadow-sm'

    if (isCenterZone) {
      return (
        <div
          key={zoneIndex}
          className={`${gridContainerClass} ring-4 ring-indigo-50`}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(cellIndex => {
            if (cellIndex === 4) {
              return (
                <GridCell key={cellIndex} text={data.mainGoal} type="main" />
              )
            }
            const subGoalIdx = cellIndex < 4 ? cellIndex : cellIndex - 1
            const subGoal = data.subGoals[subGoalIdx]
            return (
              <GridCell
                key={cellIndex}
                text={subGoal.title}
                type="sub-main"
                onClick={
                  onSubGoalClick
                    ? () => onSubGoalClick(subGoalIdx)
                    : undefined
                }
              />
            )
          })}
        </div>
      )
    }

    const subGoalIdx = contentIndex as number
    const subGoal = data.subGoals[subGoalIdx]

    return (
      <div key={zoneIndex} className={gridContainerClass}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(cellIndex => {
          if (cellIndex === 4) {
            return (
              <GridCell key={cellIndex} text={subGoal.title} type="sub-main" />
            )
          }
          const taskIdx = cellIndex < 4 ? cellIndex : cellIndex - 1
          const task = subGoal.tasks[taskIdx]

          return (
            <GridCell
              key={cellIndex}
              text={task.title}
              type="task"
              isCompleted={task.isCompleted}
              onClick={() => openTask(subGoalIdx, taskIdx)}
            />
          )
        })}
      </div>
    )
  }

  const renderSheet = () => {
    if (!selectedTask) return null
    const { task } = selectedTask

    const completedCount = task.checklist.filter(i => i.checked).length
    const totalCount = task.checklist.length
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

    return (
      <>
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 animate-in fade-in duration-200"
          onClick={() => setSelectedTask(null)}
        />
        <div
          ref={taskSheetRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-sheet-title"
          className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col"
        >
          <div
            className={`p-6 border-b border-gray-100 flex items-start justify-between transition-colors ${
              task.isCompleted ? 'bg-emerald-50' : 'bg-gray-50/50'
            }`}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block">
                  Micro Tarefa
                </span>
                {task.isCompleted && (
                  <span className="flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                    <CheckCircle2 size={10} /> CONCLUÍDO
                  </span>
                )}
              </div>
              <h2 id="task-sheet-title" className="text-xl font-bold text-gray-900 leading-tight">
                {task.title}
              </h2>
            </div>
            <button
              ref={closeSheetButtonRef}
              onClick={() => setSelectedTask(null)}
              aria-label="Fechar detalhes da etapa"
              className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-800 font-semibold">
                <Info size={18} className="text-indigo-500" />
                <h3>Como fazer</h3>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm bg-indigo-50/30 p-4 rounded-xl border border-indigo-50">
                {task.description}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-gray-800 font-semibold">
                <div className="flex items-center gap-2">
                  <CheckSquare size={18} className="text-green-500" />
                  <h3>Checklist</h3>
                </div>
                <span className="text-xs font-normal text-gray-500">
                  {completedCount}/{totalCount}
                </span>
              </div>

              <ul className="space-y-3">
                {task.checklist.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={item.checked}
                      onClick={() => handleToggleCheck(item.id)}
                      className={`flex w-full items-start gap-3 p-3 text-left rounded-lg border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        item.checked
                          ? 'bg-green-50 border-green-200'
                          : 'bg-white border-gray-100 hover:border-indigo-200'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                          item.checked
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {item.checked && <CheckCircle2 size={14} className="text-white" />}
                      </span>
                      <span
                        className={`text-sm ${
                          item.checked
                            ? 'text-green-800 line-through opacity-70'
                            : 'text-gray-700'
                        }`}
                      >
                        {item.text}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-800 font-semibold">
                <TrendingUp size={18} className="text-blue-500" />
                <h3>Progresso</h3>
              </div>
              <div className="bg-gray-100 h-4 rounded-full overflow-hidden relative">
                <div
                  className={`absolute top-0 left-0 h-full transition-all duration-500 rounded-full ${
                    task.isCompleted
                      ? 'bg-emerald-500'
                      : 'brand-surface'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="space-y-3 pb-6">
              <div className="flex items-center gap-2 text-gray-800 font-semibold">
                <Lightbulb size={18} className="text-amber-500" />
                <h3>Dica de Ouro</h3>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-sm text-amber-900 leading-relaxed italic">
                “{task.advice}”
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50 text-center text-xs text-gray-400">
            Complete o checklist para marcar a tarefa como concluída.
          </div>
        </div>
      </>
    )
  }

  if (viewMode === 'journey') {
    return (
      <div className="w-full animate-in fade-in duration-500">
        <JourneyView
          key={journeyProgress.currentStageIndex}
          data={data}
          onBack={() => setViewMode('matrix')}
          onSelectTask={openTask}
        />
        {renderSheet()}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center w-full max-w-[1200px] mx-auto animate-fade-in pb-12 relative">
      <div className="mb-7 flex w-full flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="brand-text text-xs font-black uppercase tracking-[0.16em]">Seu plano está pronto</p>
          <h2 className="brand-text mt-1 text-2xl font-black tracking-tight sm:text-3xl">{data.mainGoal}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownload}
            disabled={isExporting}
            aria-busy={isExporting}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-wait disabled:bg-gray-100"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isExporting ? 'Gerando...' : 'Salvar imagem'}
          </button>
          <button
            onClick={onReset}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50"
          >
            <RefreshCcw size={16} />
            Novo
          </button>
        </div>
      </div>

      <section className="journey-invitation relative mb-8 w-full overflow-hidden rounded-[2rem] brand-surface px-6 py-7 text-white shadow-xl shadow-indigo-200/60 sm:px-9 sm:py-8">
        <div className="journey-invitation-glow" aria-hidden="true" />
        <div className="relative z-10 grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20 sm:grid">
              <Compass size={25} />
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-violet-100">
                <Sparkles size={14} /> Da estratégia para a ação
              </div>
              <h3 className="text-2xl font-black tracking-tight sm:text-3xl">
                {journeyProgress.percentage > 0 ? 'Continue de onde parou.' : 'Agora você tem por onde começar.'}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-indigo-100 sm:text-base">
                Sua jornada organiza as 64 etapas na ordem recomendada e destaca uma única prioridade por vez. Sem ficar encarando a matriz pensando “e agora?”.
              </p>
            </div>
          </div>

          <div className="min-w-64 rounded-2xl bg-slate-950/20 p-3 ring-1 ring-white/15 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between px-1 text-xs font-bold text-indigo-100">
              <span>{journeyProgress.completedItems}/{journeyProgress.totalItems} ações</span>
              <span>{journeyProgress.percentage}%</span>
            </div>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${journeyProgress.percentage}%` }} />
            </div>
            <button
              type="button"
              onClick={() => setViewMode('journey')}
              className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-600"
            >
              {journeyProgress.percentage > 0 ? <Play size={17} fill="currentColor" /> : <Compass size={18} />}
              {journeyProgress.percentage === 100 ? 'Rever jornada' : journeyProgress.percentage > 0 ? 'Continuar jornada' : 'Iniciar jornada'}
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      <div
        ref={printRef}
        id="mandalart-print-area"
        className="p-4 sm:p-10 bg-white/50 backdrop-blur-sm shadow-xl border border-white/50 rounded-3xl flex flex-col items-center"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">
            {data.mainGoal}
          </h2>
          <p className="text-sm text-gray-500 mt-2 uppercase tracking-widest font-semibold">
            Plano de Ação Mandalart
          </p>
        </div>

        <div
          id="mandalart-grid-container"
          className="hidden sm:grid grid-cols-3 gap-6 p-2 mx-auto"
          style={{
            width: 'min(95vw, 900px)',
            height: 'min(95vw, 900px)',
            aspectRatio: '1/1'
          }}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(zoneIndex => renderZone(zoneIndex))}
        </div>

        <div className="sm:hidden w-full space-y-8">
          <section className="space-y-3">
            <div>
              <h3 className="font-bold text-gray-900">Visão geral</h3>
              <p className="text-sm text-gray-500 mt-1">
                Toque em um pilar para abrir suas ações.
              </p>
            </div>
            <div className="w-full aspect-square">
              {renderZone(4, openMobileArea)}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="font-bold text-gray-900">Ações por área</h3>
              <p className="text-sm text-gray-500 mt-1">
                Abra uma área para consultar e marcar suas tarefas.
              </p>
            </div>

            <div className="space-y-3">
              {[0, 1, 2, 3, 5, 6, 7, 8].map((zoneIndex, areaIndex) => (
                <details
                  key={zoneIndex}
                  id={`mobile-area-${areaIndex}`}
                  open={openMobileAreaIndex === areaIndex}
                  onToggle={event => {
                    const isOpen = event.currentTarget.open
                    setOpenMobileAreaIndex(currentIndex =>
                      isOpen
                        ? areaIndex
                        : currentIndex === areaIndex
                          ? null
                          : currentIndex
                    )
                  }}
                  className="group scroll-mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden"
                >
                  <summary className="min-h-14 px-4 py-3 flex items-center gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="w-7 h-7 shrink-0 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold">
                      {areaIndex + 1}
                    </span>
                    <span className="flex-1 text-left text-sm font-semibold text-gray-800">
                      {data.subGoals[areaIndex].title}
                    </span>
                    <ChevronDown className="w-5 h-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="p-3 pt-0">
                    <div className="w-full aspect-square">
                      {renderZone(zoneIndex)}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>
        </div>

        <div className="w-full flex justify-between items-center mt-6 px-4">
          <div className="text-xs"><BrandLogo iconSize={20} /></div>
          <div className="text-xs text-gray-400">Gerado com IA</div>
        </div>
      </div>

      {renderSheet()}
    </div>
  )
}
