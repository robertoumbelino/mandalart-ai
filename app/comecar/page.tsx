import type { Metadata } from 'next'
import { SalesJourney } from './SalesJourney'

export const metadata: Metadata = {
  title: 'Seu sonho merece um primeiro passo | Mandalart',
  description:
    'Responda 4 perguntas e conheça seu plano personalizado: 8 pilares, 64 etapas e progresso salvo. R$ 37, pagamento único.',
  openGraph: {
    title: 'Seu sonho merece um primeiro passo.',
    description:
      'Transforme seu objetivo em um plano completo. Pagamento único de R$ 37 e garantia de 7 dias.',
    locale: 'pt_BR',
    type: 'website'
  }
}

export default function BeginPage() {
  return <SalesJourney />
}
