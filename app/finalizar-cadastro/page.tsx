import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandLogo } from '@/app/components/Brand'
import { registrationFromToken } from '@/lib/account-registration'
import { RegistrationForm } from './RegistrationForm'

export const metadata: Metadata = {
  title: 'Concluir cadastro | Mandalart',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function RegistrationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = '' } = await searchParams
  const account = await registrationFromToken(token)
  return <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
    <div className="mx-auto max-w-md">
      <Link href="/" aria-label="Mandalart, início"><BrandLogo iconSize={28} /></Link>
      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <span className="text-xs font-bold tracking-widest text-indigo-600">SEU PLANO CONTINUA AQUI</span>
        <h1 className="mt-3 text-2xl font-bold">{account?.pending ? 'Conclua seu cadastro' : account ? 'Sua conta já está pronta' : 'Vamos concluir seu cadastro'}</h1>
        {account?.pending ? <>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{account.email.toLowerCase().endsWith('@gmail.com')
            ? 'Seu e-mail foi confirmado. Continue com o Gmail usado na compra ou escolha um nome e uma senha para acessar seu Mandalart.'
            : 'Seu e-mail foi confirmado. Escolha seu nome e uma senha para acessar seu Mandalart agora e sempre que quiser voltar.'}</p>
          <RegistrationForm token={token} email={account.email} />
        </> : <>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{account ? 'Entre com sua senha ou com Google para continuar. Sua compra está associada à sua conta.' : token ? 'Este link expirou ou já foi usado. Se você ainda não criou sua senha, solicite um novo e-mail. Sua compra continua salva.' : 'Abra o link que enviamos para o e-mail da compra para confirmar seu endereço e criar sua senha.'}</p>
          <Link href={account ? '/?entrar=1&continuar=sonho' : '/acessar'} className="brand-button mt-6 block rounded-xl px-5 py-3 text-center font-bold text-white">{account ? 'Entrar na minha conta' : 'Receber novo e-mail'}</Link>
          {!account && <Link href="/?entrar=1&continuar=sonho" className="mt-4 block text-center text-sm font-semibold text-indigo-600">Já concluí meu cadastro · Entrar</Link>}
        </>}
      </section>
    </div>
  </main>
}
