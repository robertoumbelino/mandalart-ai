'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = async (event: FormEvent) => {
    event.preventDefault()
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setError('O link está incompleto. Solicite outro na tela de entrada.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await authClient.resetPassword({ newPassword: password, token })
      if (result.error) throw new Error(result.error.message)
      router.replace('/')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível definir a senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <form onSubmit={reset} className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-black text-slate-900">Definir uma senha</h1>
        <p className="mt-2 text-sm text-slate-500">Escolha uma senha para entrar no Mandalart.AI por e-mail.</p>
        <label htmlFor="new-password" className="mt-6 block text-sm font-semibold text-slate-700">Nova senha</label>
        <input id="new-password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20" />
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="brand-button mt-6 w-full rounded-xl p-3 font-bold text-white disabled:opacity-60">{loading ? 'Salvando…' : 'Salvar senha'}</button>
        <Link href="/" className="mt-5 block text-center text-sm font-semibold text-indigo-600">Voltar ao Mandalart.AI</Link>
      </form>
    </main>
  )
}
