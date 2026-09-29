import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { getRefundableOrders } from '@/actions/refunds'
import { RefundOptions } from './RefundOptions'

export const metadata: Metadata = {
  title: 'Garantia e reembolso | Mandalart',
  robots: { index: false, follow: false },
}

export default async function RefundPage() {
  await connection()
  const orders = await getRefundableOrders()
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_90%_0%,#eeeaff,transparent_34rem),#f8faff] px-5 py-8 text-slate-800 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/sonhos" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900"><ArrowLeft size={17} /> Voltar aos meus sonhos</Link>
        <div className="mt-8 rounded-3xl border border-violet-100 bg-white p-6 shadow-[0_18px_50px_rgba(50,40,110,.07)] sm:p-9">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><ShieldCheck size={25} /></span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Seu plano, com tranquilidade.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">Se o plano não fizer sentido para você, solicite o reembolso integral em até 7 dias após a compra. Não precisa explicar o motivo. O valor volta pelo mesmo meio usado no pagamento; o prazo para aparecer depende do provedor.</p>
        </div>
        <div className="mt-7">
          {orders === null ? (
            <div className="rounded-2xl border border-violet-100 bg-white p-6 text-sm leading-7 text-slate-600">Entre na sua conta para ver as compras elegíveis. <Link href="/sonhos" className="font-bold text-violet-700 underline">Criar conta ou entrar</Link>.</div>
          ) : <RefundOptions orders={orders} />}
        </div>
      </div>
    </main>
  )
}
