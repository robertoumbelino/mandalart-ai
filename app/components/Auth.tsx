'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Loader2, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { BrandLogo } from './Brand'
import { getCurrentUser, login, register } from '@/actions/auth'
import { authClient } from '@/lib/auth/client'
import type { User } from '@/types'
import './auth.css'

interface AuthProps {
  onLogin: (user: User) => Promise<void>
  onBack?: () => void
  goal?: string
}

export const Auth: React.FC<AuthProps> = ({ onLogin, onBack, goal }) => {
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
      const { error: authError } = await authClient.signIn.social({ provider: 'google', callbackURL: window.location.origin })
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
        const { error: authError } = await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/redefinir-senha` })
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
    <main className="auth-screen">
      <header className="auth-header">
        {onBack ? <button type="button" onClick={onBack} className="auth-brand" aria-label="Mandalart.AI, início"><BrandLogo iconSize={28} /></button> : <Link href="/" className="auth-brand" aria-label="Mandalart.AI, início"><BrandLogo iconSize={28} /></Link>}
        {onBack && <button type="button" onClick={onBack} className="auth-back"><ArrowLeft size={17} /> Voltar ao início</button>}
      </header>

      <div className="auth-content">
        <section className="auth-story" aria-labelledby="auth-title">
          <span className="auth-eyebrow"><Sparkles size={17} /> UM PASSO DE CADA VEZ</span>
          <h1 id="auth-title">Seu sonho merece <span className="brand-text">um lugar para crescer.</span></h1>
          <p>Entre para guardar suas ideias, criar seu Mandalart e acompanhar cada passo do seu caminho.</p>
          {goal && <div className="auth-goal"><span>O sonho que você trouxe</span><strong>{goal}</strong><small><Check size={15} /> Vai continuar aqui depois de entrar.</small></div>}
          <div className="auth-illustration" aria-hidden="true">
            <div className="auth-orbit" />
            <div className="auth-plan">
              <span className="auth-plan-label">SEU MANDALART <Sparkles size={16} /></span>
              <div className="auth-plan-grid">
                {['Aprender', 'Preparar', 'Explorar', 'Praticar', 'Seu sonho', 'Cuidar', 'Organizar', 'Conectar', 'Avançar'].map((item, index) => <span key={item} className={index === 4 ? 'auth-plan-center' : ''}>{item}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section className="auth-panel" aria-labelledby="auth-panel-title">
          <div className="auth-panel-heading">
            <span className="auth-panel-icon"><Sparkles size={21} /></span>
            <h2 id="auth-panel-title">{mode === 'register' ? 'Crie seu espaço' : mode === 'forgot' ? 'Recupere seu acesso' : 'Que bom ter você aqui'}</h2>
            <p>{mode === 'register' ? 'Comece a transformar seus sonhos em passos possíveis.' : mode === 'forgot' ? 'Enviaremos um link para você definir uma nova senha.' : 'Entre para continuar de onde seu sonho começou.'}</p>
          </div>

          {mode !== 'forgot' ? (
            <div className="auth-tabs" role="group" aria-label="Escolha como continuar">
              <button type="button" disabled={loading} onClick={() => selectMode('login')} aria-pressed={mode === 'login'}>Entrar</button>
              <button type="button" disabled={loading} onClick={() => selectMode('register')} aria-pressed={mode === 'register'}>Criar conta</button>
            </div>
          ) : <button type="button" className="auth-inline-back" onClick={() => selectMode('login')}><ArrowLeft size={15} /> Voltar para entrar</button>}

          {mode !== 'forgot' && <>
            <button type="button" onClick={handleGoogle} disabled={loading} className="auth-google">
              <Image src="/google-g.png" alt="" aria-hidden="true" width={20} height={21} className="auth-google-icon" />
              Continuar com Google
            </button>
            <div className="auth-divider"><span>ou use seu e-mail</span></div>
          </>}

          <form onSubmit={handleSubmit} className="auth-form">
            <label htmlFor="email">E-mail</label>
            <div className="auth-field"><Mail size={18} aria-hidden="true" /><input id="email" type="email" required maxLength={254} autoComplete="email" disabled={loading} value={email} onChange={event => setEmail(event.target.value)} placeholder="seu@email.com" /></div>
            {mode !== 'forgot' && <>
              <label htmlFor="password">Senha</label>
              <div className="auth-field"><LockKeyhole size={18} aria-hidden="true" /><input id="password" type="password" required minLength={8} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} disabled={loading} value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === 'register' ? 'Mínimo de 8 caracteres' : 'Sua senha'} /></div>
            </>}
            {error && <p role="alert" className="auth-feedback auth-error">{error}</p>}
            {message && <p role="status" className="auth-feedback auth-success">{message}</p>}
            <button type="submit" disabled={loading} className="auth-submit brand-button">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <>{mode === 'register' ? 'Criar minha conta' : mode === 'forgot' ? 'Enviar link' : 'Entrar e continuar'} <ArrowRight size={19} /></>}
            </button>
          </form>

          {mode === 'login' && <button type="button" onClick={() => selectMode('forgot')} className="auth-forgot">Esqueci minha senha</button>}
          <p className="auth-legal">Ao continuar, você concorda com os <Link href="/termos">Termos de Uso</Link> e a <Link href="/privacidade">Política de Privacidade</Link>.</p>
        </section>
      </div>
    </main>
  )
}
