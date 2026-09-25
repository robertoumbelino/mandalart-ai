'use client'

import React, { useState } from 'react'
import { BrandIcon, BrandWordmark } from './Brand'
import Link from 'next/link'
import { Mail, Lock, LogIn, UserPlus, Loader2 } from 'lucide-react'
import { getCurrentUser, login, register } from '@/actions/auth'
import { authClient } from '@/lib/auth/client'
import type { User } from '@/types'

interface AuthProps {
  onLogin: (user: User) => Promise<void>
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const selectMode = (next: typeof mode) => {
    setMode(next)
    setError(null)
    setMessage(null)
  }

  const handleGoogle = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error: authError } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.origin
      })
      if (authError) throw new Error(authError.message)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar com Google.')
      setLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'forgot') {
        const { error: authError } = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/redefinir-senha`
        })
        if (authError) throw new Error(authError.message)
        setMessage('Se houver uma conta com esse e-mail, enviaremos um link para definir sua senha.')
        return
      }
      await (mode === 'login' ? login : register)(email, password)
      const user = await getCurrentUser()
      if (!user) throw new Error('Não foi possível confirmar o acesso. Confira seu e-mail ou entre com Google.')
      await onLogin(user)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível continuar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4 drop-shadow-xl">
            <BrandIcon size={80} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900"><BrandWordmark /></h1>
          <p className="text-slate-500 mt-2 font-medium">Sua estratégia começa aqui.</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
          {mode !== 'forgot' ? (
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
              <button type="button" disabled={loading} onClick={() => selectMode('login')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Entrar
              </button>
              <button type="button" disabled={loading} onClick={() => selectMode('register')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'register' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Criar conta
              </button>
            </div>
          ) : (
            <div className="mb-6">
              <button type="button" onClick={() => selectMode('login')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">← Voltar para entrar</button>
              <h2 className="mt-4 text-xl font-black text-slate-900">Definir uma senha</h2>
              <p className="mt-2 text-sm text-slate-500">Enviaremos um link para seu e-mail.</p>
            </div>
          )}

          {mode !== 'forgot' && (
            <>
              <button type="button" onClick={handleGoogle} disabled={loading} className="w-full min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 flex items-center justify-center gap-3">
                <span aria-hidden="true" className="text-base font-black text-blue-600">G</span>
                Continuar com Google
              </button>
              <div className="my-6 flex items-center gap-3" aria-hidden="true">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-xs font-bold uppercase tracking-wide text-slate-300">ou use seu e-mail</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase px-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input id="email" type="email" required maxLength={254} autoComplete="email" disabled={loading} value={email} onChange={event => setEmail(event.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-900 transition-all outline-none font-medium disabled:opacity-60" placeholder="exemplo@email.com" />
              </div>
            </div>
            {mode !== 'forgot' && (
              <div className="space-y-1">
                <label htmlFor="password" className="text-xs font-bold text-slate-400 uppercase px-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input id="password" type="password" required minLength={8} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} disabled={loading} value={password} onChange={event => setPassword(event.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-900 transition-all outline-none font-medium disabled:opacity-60" placeholder="Mínimo de 8 caracteres" />
                </div>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}
            {message && <p role="status" className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 p-3 rounded-xl">{message}</p>}
            <button type="submit" disabled={loading} className="w-full py-4 brand-button text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 className="animate-spin" /> : mode === 'register' ? <><UserPlus size={20} /> Criar conta</> : mode === 'forgot' ? <><Mail size={20} /> Enviar link</> : <><LogIn size={20} /> Entrar</>}
            </button>
          </form>

          {mode === 'login' && <button type="button" onClick={() => selectMode('forgot')} className="mt-4 w-full text-center text-sm font-semibold text-indigo-600 hover:text-indigo-700">Esqueci minha senha</button>}
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
