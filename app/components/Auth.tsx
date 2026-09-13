'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import Script from 'next/script'
import { ArrowLeft, Mail, Lock, LogIn, UserPlus, Loader2 } from 'lucide-react'
import { login, loginWithGoogle, register } from '@/actions/auth'
import type { User } from '@/types'

type GoogleCredentialResponse = {
  credential: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (configuration: {
            client_id: string
            callback: (response: GoogleCredentialResponse) => void
            auto_select?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            configuration: {
              type: 'standard'
              theme: 'outline'
              size: 'large'
              text: 'signin_with' | 'signup_with'
              shape: 'pill'
              logo_alignment: 'left'
              locale: 'pt-BR'
              width: number
            }
          ) => void
        }
      }
    }
  }
}

interface AuthProps {
  onLogin: (user: User) => Promise<void>
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [linkingPassword, setLinkingPassword] = useState('')
  const [pendingLink, setPendingLink] = useState<{ credential: string; email: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const googleCallbackRef = useRef<(response: GoogleCredentialResponse) => void>(() => undefined)
  const googleInitializedRef = useRef(false)
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  const busy = loading || googleLoading

  const selectMode = (loginMode: boolean) => {
    setIsLogin(loginMode)
    setPendingLink(null)
    setLinkingPassword('')
    setError(null)
  }

  const finishGoogleLogin = useCallback(async (credential: string, currentPassword?: string) => {
    setGoogleLoading(true)
    setError(null)
    try {
      const result = await loginWithGoogle(credential, currentPassword)
      if (result.status === 'password_required') {
        setPendingLink({ credential, email: result.email })
        setLinkingPassword('')
        return
      }
      if (result.status === 'link_error') {
        setError(result.message)
        return
      }
      await onLogin(result.user)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar com Google.')
    } finally {
      setGoogleLoading(false)
    }
  }, [onLogin])

  useEffect(() => {
    googleCallbackRef.current = response => {
      void finishGoogleLogin(response.credential)
    }
  }, [finishGoogleLogin])

  useEffect(() => {
    if (!googleReady || !googleClientId || !window.google || googleInitializedRef.current) return

    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: response => googleCallbackRef.current(response),
      auto_select: false
    })
    googleInitializedRef.current = true
  }, [googleClientId, googleReady])

  useEffect(() => {
    const button = googleButtonRef.current
    if (!googleReady || !googleInitializedRef.current || !window.google || !button || pendingLink) return

    button.replaceChildren()
    window.google.accounts.id.renderButton(button, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: isLogin ? 'signin_with' : 'signup_with',
      shape: 'pill',
      logo_alignment: 'left',
      locale: 'pt-BR',
      width: Math.min(336, Math.floor(button.getBoundingClientRect().width))
    })
  }, [googleReady, isLogin, pendingLink])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const authenticate = isLogin ? login : register
      const user = await authenticate(email, password)
      await onLogin(user)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível continuar.')
    } finally {
      setLoading(false)
    }
  }

  const handleLinkSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!pendingLink) return
    await finishGoogleLogin(pendingLink.credential, linkingPassword)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      {googleClientId && (
        <Script
          src="https://accounts.google.com/gsi/client?hl=pt-BR"
          strategy="afterInteractive"
          onReady={() => setGoogleReady(true)}
          onError={() => setError('Não foi possível carregar o login com Google.')}
        />
      )}
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4 drop-shadow-xl">
            <Image src="/mandalart-logo.svg" alt="" width={80} height={80} priority />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Mandalart.AI</h1>
          <p className="text-slate-500 mt-2 font-medium">Sua estratégia começa aqui.</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
          {pendingLink ? (
            <form onSubmit={handleLinkSubmit} className="space-y-5">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingLink(null)
                    setLinkingPassword('')
                    setError(null)
                  }}
                  className="mb-4 flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-indigo-600"
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
                <h2 className="text-xl font-black text-slate-900">Vincular conta existente</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Já existe uma conta para <strong className="text-slate-700">{pendingLink.email}</strong>. Digite a senha atual uma única vez para confirmar o vínculo com o Google.
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="linking-password" className="text-xs font-bold text-slate-400 uppercase px-1">Senha atual</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input id="linking-password" type="password" required minLength={8} maxLength={72} autoComplete="current-password" autoFocus value={linkingPassword} onChange={event => setLinkingPassword(event.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-900 transition-all outline-none font-medium" />
                </div>
              </div>

              {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}

              <button type="submit" disabled={busy} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2">
                {googleLoading ? <Loader2 className="animate-spin" /> : <><LogIn size={20} /> Confirmar e vincular</>}
              </button>
            </form>
          ) : (
            <>
              <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                <button type="button" disabled={busy} onClick={() => selectMode(true)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  Entrar
                </button>
                <button type="button" disabled={busy} onClick={() => selectMode(false)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  Criar conta
                </button>
              </div>

              {googleClientId && (
                <div className={googleLoading ? 'pointer-events-none opacity-60' : undefined}>
                  <div ref={googleButtonRef} className="min-h-10 flex justify-center" aria-label="Login com Google" />
                  {googleLoading && <p className="mt-2 text-center text-xs font-medium text-slate-500">Confirmando sua conta Google…</p>}
                </div>
              )}

              {googleClientId && (
                <div className="my-6 flex items-center gap-3" aria-hidden="true">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-300">ou use seu e-mail</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase px-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input id="email" type="email" required maxLength={254} autoComplete="email" disabled={busy} value={email} onChange={event => setEmail(event.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-900 transition-all outline-none font-medium disabled:opacity-60" placeholder="exemplo@email.com" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="password" className="text-xs font-bold text-slate-400 uppercase px-1">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input id="password" type="password" required minLength={8} maxLength={72} autoComplete={isLogin ? 'current-password' : 'new-password'} disabled={busy} value={password} onChange={event => setPassword(event.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-900 transition-all outline-none font-medium disabled:opacity-60" placeholder="Mínimo de 8 caracteres" />
                  </div>
                </div>

                {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}

                <button type="submit" disabled={busy} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 mt-2">
                  {loading ? <Loader2 className="animate-spin" /> : isLogin ? <><LogIn size={20} /> Entrar</> : <><UserPlus size={20} /> Criar conta</>}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">
            Ao continuar, você concorda com os{' '}
            <Link href="/termos" className="font-semibold text-slate-500 hover:text-indigo-600">Termos de Uso</Link>
            {' '}e a{' '}
            <Link href="/privacidade" className="font-semibold text-slate-500 hover:text-indigo-600">Política de Privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}
