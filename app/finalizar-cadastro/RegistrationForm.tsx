'use client'

import { useState, useTransition, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { completeRegistration } from '@/actions/complete-registration'

export function RegistrationForm({ token, email }: { token: string; email: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    setError('')
    startTransition(async () => {
      try {
        const result = await completeRegistration({ token, name: data.get('name'), password: data.get('password'), confirmation: data.get('confirmation') })
        if ('error' in result) { setError(result.error); return }
        router.replace('/?continuar=sonho')
        router.refresh()
      } catch { setError('Não foi possível concluir agora. Tente novamente; sua compra está salva.') }
    })
  }
  const inputClass = 'mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60'
  return <form onSubmit={submit} className="mt-6 space-y-4">
    <div><label htmlFor="registration-email" className="text-sm font-semibold">E-mail da sua conta</label><input id="registration-email" type="email" value={email} readOnly autoComplete="email" className={`${inputClass} bg-slate-50 text-slate-600`} /></div>
    <div><label htmlFor="registration-name" className="text-sm font-semibold">Seu nome</label><input id="registration-name" name="name" autoComplete="name" required minLength={2} maxLength={80} disabled={pending} className={inputClass} /></div>
    <div><label htmlFor="registration-password" className="text-sm font-semibold">Crie sua senha</label><input id="registration-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={pending} aria-describedby="password-hint" className={inputClass} /><p id="password-hint" className="mt-1 text-xs text-slate-500">Use de 8 a 72 caracteres.</p></div>
    <div><label htmlFor="registration-confirmation" className="text-sm font-semibold">Confirme sua senha</label><input id="registration-confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={pending} className={inputClass} /></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button type="submit" disabled={pending} className="brand-button w-full rounded-xl px-5 py-3 font-bold text-white disabled:opacity-60">{pending ? 'Concluindo cadastro…' : 'Concluir cadastro e abrir meu Mandalart'}</button>
    {error && <Link href="/acessar" className="block text-center text-sm font-semibold text-indigo-600">Receber novas instruções por e-mail</Link>}
    <p className="text-center text-xs leading-relaxed text-slate-500">Ao concluir, você concorda com os <Link href="/termos" className="underline">Termos de Uso</Link> e a <Link href="/privacidade" className="underline">Política de Privacidade</Link>.</p>
  </form>
}
