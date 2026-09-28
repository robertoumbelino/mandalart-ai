import type { Metadata } from 'next'
import Link from 'next/link'
import { AccessRequest } from './AccessRequest'

export const metadata: Metadata = {
  title: 'Acessar meu Mandalart | Mandalart.AI',
  description: 'Receba por e-mail um link para continuar seus planos sem senha.',
}

export default function AccessPage() {
  return <main className="min-h-screen bg-[#f8f7ff] px-5 py-8 text-[#24304a]">
    <div className="mx-auto max-w-md">
      <Link href="/" className="text-sm font-bold text-[#6334ff]">← Mandalart.AI</Link>
      <div className="mt-16 rounded-[22px] border border-[#e7e2f4] bg-white p-7 shadow-[0_20px_55px_#24204a13] sm:p-9">
        <span className="text-xs font-extrabold tracking-[.12em] text-[#6334ff]">SEU PLANO CONTINUA AQUI</span>
        <h1 className="mt-4 text-3xl font-bold leading-tight">Entre sem senha.</h1>
        <p className="mt-3 leading-relaxed text-[#56617a]">Comprou um Mandalart? Informe o e-mail usado no pagamento. Enviaremos um link para você abrir seus planos neste aparelho.</p>
        <AccessRequest />
        <p className="mt-6 text-xs leading-relaxed text-[#6b7280]">O link funciona por 48 horas e pode ser usado uma vez. Se você usa Google ou senha, <Link href="/?entrar=1" className="font-semibold text-[#6334ff] underline">entre por aqui</Link>.</p>
      </div>
    </div>
  </main>
}
