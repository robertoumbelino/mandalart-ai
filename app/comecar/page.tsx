import type { Metadata } from 'next'
import { Onboarding } from './Onboarding'

export const metadata: Metadata = {
  title: 'Seu sonho merece um primeiro passo | Mandalart.AI',
  description:
    'Responda 6 perguntas simples e descubra um primeiro passo para o seu sonho. Prévia gratuita, sem cadastro. Um plano que começa com você.',
  openGraph: {
    title: 'Seu sonho merece um primeiro passo.',
    description:
      'Descubra por onde começar com o Mandalart.AI. Prévia gratuita, sem cadastro.',
    locale: 'pt_BR',
    type: 'website'
  }
}

export default function BeginPage() {
  return <Onboarding />
}
