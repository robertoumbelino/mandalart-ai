import React, { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import {
  Download,
  RefreshCcw,
  X,
  Info,
  CheckCircle2,
  TrendingUp,
  Lightbulb,
  CheckSquare
} from 'lucide-react'
import { MandalartData, SubGoal, Task } from '../types'
import { GridCell } from './GridCell'

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
  const [selectedTask, setSelectedTask] = useState<{
    task: Task
    subGoalIndex: number
    taskIndex: number
  } | null>(null)

  const handleDownload = async () => {
    if (printRef.current) {
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
              // 1. Force a very large, fixed wrapper size
              wrapper.style.width = '1600px'
              wrapper.style.height = 'auto'
              wrapper.style.padding = '60px'
              wrapper.style.boxShadow = 'none'
              wrapper.style.background = '#ffffff'

              // 2. Force the grid to be large (1400px)
              // This gives each cell ~155px width/height.
              gridContainer.style.width = '1400px'
              gridContainer.style.height = '1400px'
              gridContainer.style.maxWidth = 'none'
              gridContainer.style.maxHeight = 'none'

              // 3. IMPORTANT: Disable line-clamping on all text spans in the clone
              // This ensures that even if text is long, it prints fully (given the large cell size).
              const textSpans = gridContainer.querySelectorAll('span')
              textSpans.forEach((span: HTMLSpanElement) => {
                // Remove line-clamp classes logic if possible, or override styles
                span.style.webkitLineClamp = 'unset'
                span.style.display = 'block' // often needed to reset -webkit-box
                span.style.overflow = 'visible'

                // Optional: ensure font size is consistent if needed,
                // but typically the large cell with default font size is enough.
                // We can force a slightly larger font for the huge resolution if it looks too small.
                span.style.fontSize = '12px'
                span.style.lineHeight = '1.3'
              })
            }
          }
        })

        const image = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        link.href = image
        link.download = `mandalart-${data.mainGoal
          .replace(/\s+/g, '-')
          .toLowerCase()}.png`
        link.click()
      } catch (err) {
        console.error('Export failed:', err)
        alert('Não foi possível gerar a imagem. Tente novamente.')
      }
    }
  }

  const handleToggleCheck = (checkItemId: string) => {
    if (!selectedTask) return

    const newData = { ...data }
    const task =
      newData.subGoals[selectedTask.subGoalIndex].tasks[selectedTask.taskIndex]

    // Toggle the specific item
    task.checklist = task.checklist.map(item =>
      item.id === checkItemId ? { ...item, checked: !item.checked } : item
    )

    // Check if ALL items are checked
    const allChecked = task.checklist.every(item => item.checked)
    task.isCompleted = allChecked

    // Update state
    onDataUpdate(newData)

    // Update local selected task to reflect changes in UI immediately
    setSelectedTask({
      ...selectedTask,
      task: { ...task }
    })
  }

  const getZoneContentIndex = (zoneIndex: number): number | 'CENTER' => {
    if (zoneIndex === 4) return 'CENTER'
    return zoneIndex < 4 ? zoneIndex : zoneIndex - 1
  }

  const renderZone = (zoneIndex: number) => {
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
              <GridCell key={cellIndex} text={subGoal.title} type="sub-main" />
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
              onClick={() =>
                setSelectedTask({
                  task,
                  subGoalIndex: subGoalIdx,
                  taskIndex: taskIdx
                })
              }
            />
          )
        })}
      </div>
    )
  }

  // Sheet Component Content
  const renderSheet = () => {
    if (!selectedTask) return null
    const { task } = selectedTask

    const completedCount = task.checklist.filter(i => i.checked).length
    const totalCount = task.checklist.length
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

    return (
      <>
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 animate-in fade-in duration-200"
          onClick={() => setSelectedTask(null)}
        />
        <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
          {/* Header */}
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
              <h2 className="text-xl font-bold text-gray-900 leading-tight">
                {task.title}
              </h2>
            </div>
            <button
              onClick={() => setSelectedTask(null)}
              className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Description */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-800 font-semibold">
                <Info size={18} className="text-indigo-500" />
                <h3>Como fazer</h3>
              </div>
              <p className="text-gray-600 leading-relaxed text-sm bg-indigo-50/30 p-4 rounded-xl border border-indigo-50">
                {task.description}
              </p>
            </div>

            {/* Checklist */}
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
                  <li
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      item.checked
                        ? 'bg-green-50 border-green-200'
                        : 'bg-white border-gray-100 hover:border-indigo-200'
                    }`}
                    onClick={() => handleToggleCheck(item.id)}
                  >
                    <div
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        item.checked
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300'
                      }`}
                    >
                      {item.checked && (
                        <CheckCircle2 size={14} className="text-white" />
                      )}
                    </div>
                    <span
                      className={`text-sm ${
                        item.checked
                          ? 'text-green-800 line-through opacity-70'
                          : 'text-gray-700'
                      }`}
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Progress Scale */}
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
                      : 'bg-gradient-to-r from-blue-400 to-indigo-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Advice */}
            <div className="space-y-3 pb-6">
              <div className="flex items-center gap-2 text-gray-800 font-semibold">
                <Lightbulb size={18} className="text-amber-500" />
                <h3>Dica de Ouro</h3>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-sm text-amber-900 leading-relaxed italic">
                "{task.advice}"
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 bg-gray-50 text-center text-xs text-gray-400">
            Complete o checklist para marcar a tarefa como concluída.
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col items-center w-full max-w-[1200px] mx-auto animate-fade-in pb-12 relative">
      <div className="flex gap-4 mb-8">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-black transition shadow-lg font-medium text-sm"
        >
          <Download size={16} />
          Salvar Imagem
        </button>
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-6 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition shadow-sm font-medium text-sm"
        >
          <RefreshCcw size={16} />
          Novo
        </button>
      </div>

      {/* The Printable Area Wrapper */}
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
          className="grid grid-cols-3 gap-3 sm:gap-6 p-2 mx-auto"
          style={{
            width: 'min(95vw, 900px)',
            height: 'min(95vw, 900px)',
            aspectRatio: '1/1'
          }}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(zoneIndex => renderZone(zoneIndex))}
        </div>

        <div className="w-full flex justify-between items-center mt-6 px-4">
          <div className="text-xs text-gray-400 font-medium">Mandalart.AI</div>
          <div className="text-xs text-gray-400">Gerado com IA</div>
        </div>
      </div>

      {/* Render the Sheet */}
      {renderSheet()}
    </div>
  )
}
