'use server'

import { getPaymentOptions, startDreamCheckout } from '@/actions/payments'
import { getCurrentUser } from '@/actions/auth'
import { getDb } from '@/lib/db'
import { DREAM_PACKS } from '@/lib/dream-packs'
import { kiwifyCheckoutLink } from '@/lib/kiwify-checkout'
import { kiwifyOnboardingEnabled } from '@/lib/kiwify'
import { billingMode } from '@/lib/stripe'
import { idSchema } from '@/lib/validation'

// Ponto exclusivo do funil /comecar. Compras iniciadas pela conta usam Stripe.
export async function getOnboardingPaymentOptions() {
  if (process.env.KIWIFY_ONBOARDING_ENABLED === 'true') {
    return {
      available: kiwifyOnboardingEnabled(),
      provider: 'kiwify' as const,
      mode: billingMode(),
      pix: false,
    }
  }
  return getPaymentOptions()
}

export async function startOnboardingCheckout(pack: number, id: string) {
  if (process.env.KIWIFY_ONBOARDING_ENABLED !== 'true')
    return startDreamCheckout(pack, id, 'comecar')
  if (!kiwifyOnboardingEnabled())
    throw new Error('Checkout da Kiwify ainda não disponível.')

  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para guardar seus sonhos na sua conta.')
  if (pack !== 1 && pack !== 3) throw new Error('Pacote inválido.')
  const orderId = idSchema.parse(id)
  const offer = DREAM_PACKS[pack]
  const url = kiwifyCheckoutLink(pack, user.email, orderId)
  const checkoutCode = new URL(url).pathname.slice(1).replace(/\/$/, '')
  const mode = billingMode()
  const sql = getDb()
  const [count] = await sql`
    SELECT count(*)::int AS n FROM dream_orders
    WHERE user_id=${user.id} AND created_at>now()-interval '1 hour'
  `
  if (Number(count.n) >= 30)
    throw new Error('Muitas tentativas. Aguarde um pouco antes de tentar de novo.')

  await sql`
    INSERT INTO dream_orders(id,user_id,mode,provider,credits,amount,price_id)
    VALUES(${orderId}::uuid,${user.id},${mode},'kiwify',${pack},${offer.amount},${checkoutCode})
    ON CONFLICT DO NOTHING
  `
  const [order] = await sql`
    SELECT user_id,mode,provider,credits,amount,price_id,status
    FROM dream_orders WHERE id=${orderId}::uuid
  `
  if (
    !order ||
    order.user_id !== user.id ||
    order.mode !== mode ||
    order.provider !== 'kiwify' ||
    Number(order.credits) !== pack ||
    Number(order.amount) !== offer.amount ||
    order.price_id !== checkoutCode ||
    order.status !== 'pending'
  ) throw new Error('Pedido inválido.')

  return { url }
}

export async function checkOnboardingPayment(rawId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para consultar sua compra.')
  const id = idSchema.parse(rawId)
  const [order] = await getDb()`
    SELECT status, credited FROM dream_orders
    WHERE id=${id}::uuid AND user_id=${user.id} AND mode=${billingMode()} AND provider='kiwify'
  `
  if (!order) throw new Error('Compra não encontrada nesta conta.')
  return { status: String(order.status), credits: Number(order.credited) }
}
