'use server'

import { getCurrentUserWithCreation } from '@/actions/auth'
import { consumeRegistrationToken, registrationFromToken } from '@/lib/account-registration'
import { readAuthAccounts, readAuthSession } from '@/lib/auth/reader'
import { revokeEmailAccess } from '@/lib/email-access'

type Result = { ok: true; userId: string; completed: boolean } | { error: string }

export async function completeGoogleRegistration(token: string): Promise<Result> {
  const purchase = await registrationFromToken(token)
  if (!purchase) return { error: 'Este link expirou ou já foi usado. Solicite um novo e-mail para continuar.' }

  const { data: session, error: sessionError } = await readAuthSession()
  const email = session?.user?.email?.toLowerCase()
  if (sessionError || !email) return { error: 'Não foi possível confirmar o acesso com Google. Tente novamente.' }
  if (email !== purchase.email.toLowerCase()) {
    return { error: `Escolha no Google a conta ${purchase.email}, usada na compra.` }
  }
  if (!email.endsWith('@gmail.com') || !session.user.emailVerified) {
    return { error: 'Use um Gmail verificado ou conclua o cadastro com uma senha.' }
  }

  const { data: accounts, error: accountsError } = await readAuthAccounts()
  if (accountsError || !accounts?.some(account => account.providerId === 'google')) {
    return { error: 'Não foi possível confirmar a conta Google. Tente novamente.' }
  }

  const result = await getCurrentUserWithCreation()
  if (result?.user.id !== purchase.id) {
    return { error: 'Não foi possível associar este Google à sua compra. Entre com o Gmail usado no checkout.' }
  }
  await revokeEmailAccess()
  await consumeRegistrationToken(token, purchase.id)
  return { ok: true, userId: purchase.id, completed: purchase.pending }
}
