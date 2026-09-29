'use server'

import { z } from 'zod'
import { auth } from '@/lib/auth/server'
import { registrationFromToken, linkRegistration } from '@/lib/account-registration'
import { revokeEmailAccess } from '@/lib/email-access'

const schema = z.object({
  token: z.string().regex(/^[\w-]{32,100}$/),
  name: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(72),
  confirmation: z.string(),
}).refine(value => value.password === value.confirmation)

export async function completeRegistration(input: unknown): Promise<{ ok: true } | { error: string }> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: 'Informe seu nome e uma senha de 8 a 72 caracteres. As duas senhas devem ser iguais.' }
  const { token, name, password } = parsed.data
  const account = await registrationFromToken(token)
  if (!account) return { error: 'Este link expirou ou já foi usado. Solicite um novo e-mail para concluir o cadastro.' }
  if (!account.pending) return { error: 'Seu cadastro já está concluído. Entre com sua senha ou use “Esqueci minha senha”.' }

  try {
    // Also recovers a retry after the provider created the identity but the local
    // transaction failed. A provider identity is linked only after proving its password.
    let signedIn = await auth.signIn.email({ email: account.email, password })
    if (signedIn.error) {
      const created = await auth.signUp.email({ email: account.email, name, password })
      if (created.error) return { error: 'Não foi possível criar a senha. Se você já cadastrou este e-mail, entre ou use “Esqueci minha senha”.' }
      signedIn = await auth.signIn.email({ email: account.email, password })
    }
    if (signedIn.error || !signedIn.data?.user || signedIn.data.user.email.toLowerCase() !== account.email.toLowerCase()) {
      return { error: 'Não foi possível confirmar o cadastro. Confira se há uma confirmação adicional do serviço de autenticação no seu e-mail e tente novamente.' }
    }
    if (!await linkRegistration(token, signedIn.data.user.id, account.id, name)) {
      await auth.signOut()
      return { error: 'Este cadastro já foi concluído ou o link expirou. Entre com sua senha para continuar.' }
    }
    await revokeEmailAccess()
    return { ok: true }
  } catch {
    return { error: 'Não foi possível concluir agora. Sua compra está salva; tente novamente com este mesmo link e senha.' }
  }
}
