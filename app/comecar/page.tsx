import type { Metadata } from 'next'
import { SalesJourney } from './SalesJourney'
import { connection } from 'next/server'
import { paymentProvider } from '@/lib/stripe'
import { SalesPromotionProvider } from './SalesPromotion'

export const metadata: Metadata = {
  title: 'Seu sonho merece um primeiro passo | Mandalart',
  description:
    'Responda 4 perguntas e conheça seu plano personalizado: 8 pilares, 64 etapas e progresso salvo. Pagamento único e garantia de 7 dias.',
  openGraph: {
    title: 'Seu sonho merece um primeiro passo.',
    description:
      'Transforme seu objetivo em um plano completo. Pagamento único e garantia de 7 dias.',
    locale: 'pt_BR',
    type: 'website'
  }
}

export default async function BeginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection()
  const params = await searchParams
  // eslint-disable-next-line react-hooks/purity -- connection() makes this a request-time server render.
  const initialClock = { now: Date.now(), enabled: params.kiwify !== undefined || paymentProvider() === 'asaas' }
  return <SalesPromotionProvider initialClock={initialClock}><SalesJourney /></SalesPromotionProvider>
}
