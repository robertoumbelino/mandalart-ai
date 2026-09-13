'use client'

import React, { useState } from 'react'
import { Mail, Lock, LogIn, UserPlus, Sparkles, Loader2 } from 'lucide-react'
import { login, register } from '@/actions/auth'
import type { User } from '@/types'

interface AuthProps {
  onLogin: (user: User) => Promise<void>
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectMode = (loginMode: boolean) => {
    setIsLogin(loginMode)
    setError(null)
  }

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

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-600 text-white rounded-2xl shadow-xl mb-4">
            <Sparkles size={32} />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Mandalart.AI</h1>
          <p className="text-slate-500 mt-2 font-medium">Sua estratégia começa aqui.</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
          <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
            <button type="button" onClick={() => selectMode(true)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Entrar
            </button>
            <button type="button" onClick={() => selectMode(false)} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase px-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input id="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-900 transition-all outline-none font-medium" placeholder="exemplo@email.com" />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-xs font-bold text-slate-400 uppercase px-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input id="password" type="password" required minLength={8} maxLength={72} autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-900 transition-all outline-none font-medium" placeholder="Mínimo de 8 caracteres" />
              </div>
            </div>

            {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-100 p-3 rounded-xl">{error}</p>}

            <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 className="animate-spin" /> : isLogin ? <><LogIn size={20} /> Entrar</> : <><UserPlus size={20} /> Criar conta</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
