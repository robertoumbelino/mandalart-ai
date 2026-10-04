import { ArrowRight, Check, Lightbulb, Sparkles, Target } from 'lucide-react'
import styles from './PlanFeaturePreview.module.css'

type Feature = 'goal' | 'mandala' | 'route' | 'task' | 'advice' | 'focus'

const DESCRIPTIONS: Record<Feature, string> = {
  goal: 'Ilustração de um objetivo transformado em um plano.',
  mandala: 'Ilustração da mandala: objetivo central e oito caminhos ao redor.',
  route: 'Ilustração de uma rota com etapas em sequência.',
  task: 'Ilustração de uma tarefa com checklist.',
  advice: 'Ilustração de uma Dica de Ouro em um cartão de orientação.',
  focus: 'Ilustração da tarefa atual com progresso salvo.',
}

export function PlanFeaturePreview({ feature }: { feature: Feature }) {
  return <div className={`${styles.preview} ${styles[feature]}`} role="img" aria-label={DESCRIPTIONS[feature]}>
    <div className={styles.content} aria-hidden="true">
      {feature === 'goal' && <>
        <div className={styles.target}><Target size={23} strokeWidth={1.8} /></div>
        <div className={styles.planLines}><span /><span /><span /></div>
      </>}
      {feature === 'mandala' && <div className="mandala-grid">
        <div className="mandala-center"><Sparkles size={13} /></div>
        {Array.from({ length: 8 }, (_, index) => <div key={index} className={`mandala-cell ${index === 0 ? 'is-open' : ''}`} />)}
      </div>}
      {feature === 'route' && <div className={styles.routeSteps}>{[1, 2, 3].map(step => <div key={step}><span>{step}</span><i /></div>)}</div>}
      {feature === 'task' && <div className={styles.sheet}>
        <div className={styles.sheetTitle} />
        {[0, 1, 2].map(index => <div className={styles.checkRow} key={index}><span className={index === 0 ? styles.checked : undefined}>{index === 0 && <Check size={9} strokeWidth={3} />}</span><i /></div>)}
      </div>}
      {feature === 'advice' && <div className={styles.tipCard}><Lightbulb size={23} strokeWidth={1.8} /><div className={styles.tipLines}><span /><span /></div></div>}
      {feature === 'focus' && <>
        <span className={styles.focusLabel}>HOJE</span>
        <div className={styles.focusLines}><span /><span /></div>
        <div className={styles.progress}><span /></div>
        <div className={styles.resume}><Check size={11} /><ArrowRight size={14} /></div>
      </>}
    </div>
  </div>
}
