'use client'

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { completeRegistration } from '@/actions/complete-registration'
import { completeGoogleRegistration } from '@/actions/complete-google-registration'
import { authClient } from '@/lib/auth/client'
import { trackMetaEvent } from '@/lib/meta-events'
import { captureProductEvent, identifyProductUser } from '@/lib/posthog'

export function RegistrationForm({ token, email }: { token: string; email: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const [googlePending, setGooglePending] = useState(false)
  const googleReturnStarted = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('google') !== '1' || googleReturnStarted.current) return
    googleReturnStarted.current = true
    startTransition(async () => {
      try {
        if (params.has('neon_auth_session_verifier')) await authClient.getSession()
        const result = await completeGoogleRegistration(token)
        if ('error' in result) { setError(result.error); return }
        identifyProductUser(result.userId)
        if (result.completed) {
          captureProductEvent('registration_completed', { method: 'google' })
          trackMetaEvent({ name: 'CompleteRegistration', onceKey: `registration.${result.userId}`, eventId: `registration-${result.userId}` })
        }
        router.replace('/?continuar=sonho')
        router.refresh()
      } catch { setError('Não foi possível concluir com Google. Tente novamente; sua compra está salva.') }
    })
  }, [router, token])

  async function continueWithGoogle() {
    setError('')
    setGooglePending(true)
    try {
      const callbackURL = `${window.location.origin}/finalizar-cadastro?token=${encodeURIComponent(token)}&google=1`
      const { error: authError } = await authClient.signIn.social({ provider: 'google', callbackURL })
      if (authError) throw new Error(authError.message)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar com Google.')
      setGooglePending(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || googlePending) return
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
  return <>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {email.toLowerCase().endsWith('@gmail.com') && <div className="mt-6">
      <button type="button" onClick={continueWithGoogle} disabled={pending || googlePending} className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60">
        <Image src="/google-g.png" alt="" aria-hidden="true" width={20} height={21} />
        {googlePending ? 'Abrindo Google…' : 'Continuar com Google'}
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">Escolha a conta {email} para acessar sua compra.</p>
      <p className="mt-5 text-center text-xs font-semibold text-slate-500">ou crie uma senha</p>
    </div>}
    <form onSubmit={submit} className="mt-6 space-y-4">
    <div><label htmlFor="registration-email" className="text-sm font-semibold">E-mail da sua conta</label><input id="registration-email" type="email" value={email} readOnly autoComplete="email" className={`${inputClass} bg-slate-50 text-slate-600`} /></div>
    <div><label htmlFor="registration-name" className="text-sm font-semibold">Seu nome</label><input id="registration-name" name="name" autoComplete="name" required minLength={2} maxLength={80} disabled={pending || googlePending} className={inputClass} /></div>
    <div><label htmlFor="registration-password" className="text-sm font-semibold">Crie sua senha</label><input id="registration-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={pending || googlePending} aria-describedby="password-hint" className={inputClass} /><p id="password-hint" className="mt-1 text-xs text-slate-500">Use de 8 a 72 caracteres.</p></div>
    <div><label htmlFor="registration-confirmation" className="text-sm font-semibold">Confirme sua senha</label><input id="registration-confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={pending || googlePending} className={inputClass} /></div>
    <button type="submit" disabled={pending || googlePending} className="brand-button w-full rounded-xl px-5 py-3 font-bold text-white disabled:opacity-60">{pending ? 'Concluindo cadastro…' : 'Concluir cadastro e abrir meu Mandalart'}</button>
    {error && <Link href="/acessar" className="block text-center text-sm font-semibold text-indigo-600">Receber novas instruções por e-mail</Link>}
    <p className="text-center text-xs leading-relaxed text-slate-500">Ao concluir, você concorda com os <Link href="/termos" className="underline">Termos de Uso</Link> e a <Link href="/privacidade" className="underline">Política de Privacidade</Link>.</p>
  </form>
  </>
}
