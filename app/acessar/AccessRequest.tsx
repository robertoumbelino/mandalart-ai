'use client'

import { useState } from 'react'

export function AccessRequest() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/access/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      if (!response.ok) throw new Error('Não foi possível solicitar o link agora. Tente novamente.')
      setMessage('Se houver uma conta com esse e-mail, enviaremos um link de acesso. Confira também a caixa de spam.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Tente novamente.')
    } finally { setBusy(false) }
  }

  return <form onSubmit={submit} className="mt-7 space-y-3">
    <label htmlFor="access-email" className="block text-sm font-bold">Seu e-mail</label>
    <input id="access-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@exemplo.com" className="w-full rounded-xl border border-[#cfc9e8] px-4 py-3 text-base outline-none focus:border-[#6334ff] focus:ring-2 focus:ring-[#6334ff33]" />
    {message && <p role="status" className="rounded-xl bg-[#f2edff] p-3 text-sm text-[#5134be]">{message}</p>}
    {error && <p role="alert" className="text-sm text-[#b42318]">{error}</p>}
    <button type="submit" disabled={busy || !email.trim()} className="w-full rounded-xl bg-[#6334ff] px-5 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:bg-[#adb4c1]">{busy ? 'Solicitando link…' : 'Receber link de acesso'}</button>
  </form>
}
