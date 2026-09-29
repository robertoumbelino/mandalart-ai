import type { Metadata } from 'next'
import Link from 'next/link'
import { AccessRequest } from './AccessRequest'

export const metadata: Metadata = {
  title: 'Concluir meu cadastro | Mandalart',
  description: 'Receba as instruções para concluir seu cadastro ou recuperar sua senha.',
  robots: { index: false, follow: false },
}

export default function AccessPage() {
  return <main className="min-h-screen bg-[#f8f7ff] px-5 py-8 text-[#24304a]">
    <div className="mx-auto max-w-md">
      <Link href="/" className="text-sm font-bold text-[#6334ff]">← Mandalart</Link>
      <div className="mt-16 rounded-[22px] border border-[#e7e2f4] bg-white p-7 shadow-[0_20px_55px_#24204a13] sm:p-9">
        <span className="text-xs font-extrabold tracking-[.12em] text-[#6334ff]">SEU PLANO CONTINUA AQUI</span>
        <h1 className="mt-4 text-3xl font-bold leading-tight">Conclua seu cadastro.</h1>
        <p className="mt-3 leading-relaxed text-[#56617a]">Informe o e-mail da compra para receber um novo link e criar sua senha. Se seu cadastro já estiver completo, enviaremos as instruções para recuperar o acesso.</p>
        <AccessRequest />
        <p className="mt-6 text-xs leading-relaxed text-[#6b7280]">Já concluiu seu cadastro? <Link href="/?entrar=1" className="font-semibold text-[#6334ff] underline">Entre na sua conta</Link>.</p>
      </div>
    </div>
  </main>
}
