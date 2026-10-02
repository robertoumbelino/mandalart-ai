import { Check, Info, Lightbulb, TrendingUp } from 'lucide-react'

const paths = [
  'Mapear as entradas',
  'Registrar gastos e contas',
  'Identificar destinos do dinheiro',
  'Conferir o fluxo financeiro',
  'Clareza financeira',
  'Avaliar o que sobra',
  'Definir espaço para reserva',
  'Ajustar a organização',
  'Manter a visão atualizada'
]

export function IntroPlanVisual() {
  return (
    <div className="intro-visual" aria-hidden="true">
      <div className="intro-plan-card">
        <strong className="intro-plan-goal">Clareza financeira</strong>
        <span className="intro-plan-caption">PLANO DE AÇÃO MANDALART</span>
        <div className="intro-plan-overview">
          <strong>Visão geral</strong>
          <span>Oito caminhos para seu objetivo.</span>
        </div>
        <div className="intro-plan-grid">
          {paths.map((path, index) => <span className={index === 4 ? 'is-center' : ''} key={path}>{path}</span>)}
        </div>
      </div>
      <div className="intro-task-card">
        <span className="intro-task-label">MICROTAREFA</span>
        <strong className="intro-task-title">Listar fontes de entrada</strong>
        <div className="intro-task-block">
          <strong><Info size={11} /> Como fazer</strong>
          <p>Anote de onde pode vir dinheiro para você.</p>
        </div>
        <div className="intro-task-block">
          <strong><Check size={11} /> Checklist <small>0/3</small></strong>
          <ul>
            <li>Registre cada fonte conhecida</li>
            <li>Marque as que costumam se repetir</li>
            <li>Anote fontes ocasionais</li>
          </ul>
        </div>
        <div className="intro-task-block">
          <strong><TrendingUp size={11} /> Progresso</strong>
          <div className="intro-task-progress" />
        </div>
        <div className="intro-task-block intro-task-tip">
          <strong><Lightbulb size={11} /> Dica de ouro</strong>
          <p>Comece pelo que você já conhece.</p>
        </div>
      </div>
    </div>
  )
}
