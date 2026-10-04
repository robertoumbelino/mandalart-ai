'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, Check, Compass, ListChecks, X } from 'lucide-react'
import './product-demo.css'

import example from '@/lib/example-mandalart.json'
import { ChecklistItem } from './ChecklistItem'

const paths = example.paths

export function ProductDemo({ compact = false }: { compact?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dialogTitle = useId()
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)')
    const closeOnMobile = () => { if (!desktop.matches) dialogRef.current?.close() }
    desktop.addEventListener('change', closeOnMobile)
    return () => desktop.removeEventListener('change', closeOnMobile)
  }, [])
  const [selected, setSelected] = useState(0)
  const [selectedTask, setSelectedTask] = useState(0)
  const [checks, setChecks] = useState<boolean[][][]>(() => paths.map(path => path.tasks.map(() => [false, false, false])))
  const path = paths[selected]
  const task = path.tasks[selectedTask]
  const completed = checks[selected][selectedTask].filter(Boolean).length
  const totalCompleted = checks.flat(2).filter(Boolean).length
  const taskDetails = <>
    <div className="demo-task">
      <span className="demo-label"><ListChecks size={15} /> ETAPA {selectedTask + 1} DE 8 NESTE CAMINHO</span>
      <h3>{task.title}</h3><p>{task.description}</p>
      <ul className="space-y-3">
        {task.checklist.map((text, index) => <li key={text}>
          <ChecklistItem text={text} checked={checks[selected][selectedTask][index]} onToggle={() => setChecks(current => current.map((items, pathIndex) => pathIndex === selected ? items.map((taskChecks, taskIndex) => taskIndex === selectedTask ? taskChecks.map((value, checkIndex) => checkIndex === index ? !value : value) : taskChecks) : items))} />
        </li>)}
      </ul>
      <div className="demo-progress"><span style={{ width: `${completed / 3 * 100}%` }} /></div>
      <small aria-live="polite">{completed === 3 ? 'Etapa concluída. Pronto para continuar.' : `${completed} de 3 ações deste passo concluídas`}</small>
    </div>
    <details className="demo-all-tasks"><summary>Veja as 8 etapas deste caminho</summary><p>{path.description}</p><ol>{path.tasks.map((item, index) => <li key={item.title}><button type="button" aria-pressed={selectedTask === index} onClick={() => setSelectedTask(index)}>{item.title}</button></li>)}</ol></details>
    <p className="demo-footnote">Progresso deste exemplo: {Math.round(totalCompleted / 192 * 100)}% · {totalCompleted} de 192 ações.</p>
    <p className="demo-footnote"><Check size={14} /> No seu Mandalart, os caminhos são personalizados e o progresso fica salvo na sua conta.</p>
  </>
  return <section className={`product-demo ${compact ? 'is-compact' : ''}`} aria-label="Exemplo interativo de Mandalart para mudar de carreira">
    <div className="product-demo-heading"><span>EXEMPLO INTERATIVO</span><Compass size={18} /></div>
    <h2>É isso que você vai construir.</h2>
    <p>Um objetivo: <strong>mudar de carreira</strong>. Explore os caminhos e experimente marcar uma ação.</p>
    <div className="demo-paths" role="group" aria-label="Escolha um caminho do exemplo">
      <div className="demo-goal"><span>OBJETIVO</span><strong>Mudar de carreira</strong></div>
      {paths.map((item, index) => <button type="button" aria-pressed={selected === index} data-completed={checks[index][0].every(Boolean)} aria-label={`${String(index + 1).padStart(2, '0')} ${item.title}${checks[index][0].every(Boolean) ? ' — primeira etapa concluída' : ''}`} key={item.title} onClick={() => {
        setSelected(index)
        setSelectedTask(0)
        if (window.matchMedia('(min-width: 901px)').matches) dialogRef.current?.showModal()
      }}><span>{String(index + 1).padStart(2, '0')}</span>{item.title}{checks[index][0].every(Boolean) && <Check className="demo-path-completed" size={14} strokeWidth={3} aria-hidden="true" />}</button>)}
    </div>
    <div className="demo-inline-details">{taskDetails}</div>
    <p className="demo-desktop-hint">Clique em um caminho para experimentar uma ação.</p>
    <dialog ref={dialogRef} className="demo-dialog" aria-labelledby={dialogTitle} onClick={event => {
      if (event.target !== event.currentTarget) return
      const bounds = event.currentTarget.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close()
    }}>
      <div className="demo-dialog-header">
        <div><span className="demo-label">CAMINHO {String(selected + 1).padStart(2, '0')} · EXEMPLO</span><h2 id={dialogTitle}>{path.title}</h2></div>
        <button type="button" className="demo-dialog-close" aria-label="Fechar exemplo" onClick={() => dialogRef.current?.close()}><X size={20} /></button>
      </div>
      {taskDetails}
    </dialog>
  </section>
}

export function ProductMethod() {
  return <section className="product-method" aria-label="Método e dúvidas sobre o Mandalart">
    <div><span className="demo-label">DO OBJETIVO À AÇÃO</span><h2>O método por trás do Mandalart</h2><p>O Mandalart parte de uma estrutura japonesa de organização de objetivos em formato 9×9: um grande objetivo é dividido em 8 caminhos, que depois se transformam em ações práticas. Esse formato ficou mundialmente conhecido também pelo quadro de metas criado por Shohei Ohtani ainda no colégio.</p><p>Você vê o conjunto, escolhe uma ação e acompanha o que já fez. A IA ajuda a personalizar os caminhos a partir das suas respostas.</p></div>
    <div className="method-flow" aria-label="Objetivo, oito caminhos, ações, execução">{['Objetivo', '8 caminhos', 'Ações', 'Execução'].map((label, index) => <span key={label}>{label}{index < 3 && <ArrowRight size={16} aria-hidden="true" />}</span>)}</div>
    <h3>Mais do que um plano gerado por IA.</h3><p>O Mandalart transforma seu objetivo em caminhos e ações que você consegue visualizar e executar. A personalização acontece a partir das suas respostas.</p>
    <details><summary>Por que não simplesmente pedir um plano para uma IA?</summary><p>Você pode usar um chat para criar um bom plano. No Mandalart, você recebe uma estrutura pronta: oito caminhos, ações com checklists, próximo passo e progresso salvo em um só lugar. O valor está em organizar e usar o plano, sem precisar montar esse sistema por conta própria.</p></details>
    <details><summary>O que recebo por R$37?</summary><p>Por R$37, em pagamento único, você cria um Mandalart personalizado para seu objetivo, com 8 pilares, 64 etapas, checklists e progresso salvo. O plano é gerado após o pagamento e as perguntas específicas. Sem assinatura.</p></details>
    <details><summary>Isso garante que vou realizar meu objetivo?</summary><p>Não. O Mandalart organiza um caminho para começar e continuar. O resultado depende da execução e das suas circunstâncias; use o plano como ponto de partida e adapte a execução conforme aprende.</p></details>
  </section>
}
