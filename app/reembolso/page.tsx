import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Garantia e reembolso | Mandalart',
  robots: { index: false, follow: false },
}

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_90%_0%,#eeeaff,transparent_34rem),#f8faff] px-5 py-8 text-slate-800 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/sonhos" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900"><ArrowLeft size={17} /> Voltar aos meus sonhos</Link>
        <div className="mt-8 rounded-3xl border border-violet-100 bg-white p-6 shadow-[0_18px_50px_rgba(50,40,110,.07)] sm:p-9">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><ShieldCheck size={25} /></span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Seu plano, com tranquilidade.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">Se o plano não fizer sentido para você, solicite o reembolso integral em até 7 dias após a compra. Não precisa explicar o motivo. O valor volta pelo mesmo meio usado no pagamento; o prazo para aparecer depende do provedor.</p>
        </div>
        <div className="mt-7 rounded-2xl border border-violet-100 bg-white p-6 text-sm leading-7 text-slate-600">
          <p>Na página “Minhas compras”, você pode consultar seus pagamentos e solicitar o reembolso de uma compra elegível. Entre com a conta vinculada ao e-mail usado na compra.</p>
          <Link href="/compras" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-300 px-4 font-bold text-violet-700 hover:bg-violet-50">Ver minhas compras <ArrowRight size={17} /></Link>
        </div>
      </div>
    </main>
  )
}
