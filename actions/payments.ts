'use server'

import { getCurrentUser } from '@/actions/auth'
import { getDb } from '@/lib/db'
import {
  billingConfig,
  billingMode,
  billingOrigin,
  getStripe,
  paymentProvider,
} from '@/lib/stripe'
import { DREAM_PACKS } from '@/lib/dream-packs'
import { idSchema } from '@/lib/validation'
import { reconcileCheckout, type DreamOrder } from '@/lib/payments'
import { cleanAttribution, type Attribution } from '@/lib/attribution'
import { createAsaasCheckout, asaasCheckoutUrl, createAsaasPixQr, directAsaasPixEnabled } from '@/lib/asaas'
import { reconcileAsaasCheckout, reconcileAsaasPix } from '@/lib/asaas-payments'

type CheckoutProvider = 'stripe' | 'kiwify' | 'asaas'

export async function getPaymentOptions() {
  try {
    if (paymentProvider() === 'asaas') return {
      available: Boolean(process.env.ASAAS_API_KEY),
      provider: 'asaas' as CheckoutProvider,
      directPix: directAsaasPixEnabled(),
      ...billingConfig(),
    }
    const config = billingConfig()
    const configured = Boolean(
      process.env.STRIPE_PRICE_ONE &&
      process.env.STRIPE_PRICE_THREE &&
      process.env.STRIPE_PAYMENT_CONFIGURATION,
    )
    const enabled =
      configured &&
      (config.mode === 'test' ||
        (await getStripe().accounts.retrieve(null)).charges_enabled)
    return {
      available: enabled,
      provider: 'stripe' as CheckoutProvider,
      directPix: false,
      ...config,
    }
  } catch {
    return {
      available: false,
      provider: paymentProvider() as CheckoutProvider,
      directPix: false,
      mode: 'test' as const,
      pix: false,
    }
  }
}
export async function startDreamCheckout(
  rawPack: number,
  rawId: string,
  source: 'comecar' | 'account' = 'account',
  rawAttribution: Attribution = {},
) {
  if (paymentProvider() === 'asaas')
    return startAsaasDreamCheckout(rawPack, rawId, source, rawAttribution)
  const user = await getCurrentUser()
  if (!user)
    throw new Error('Faça login para guardar seus sonhos na sua conta.')
  if (rawPack !== 1 && rawPack !== 3) throw new Error('Pacote inválido.')
  const id = idSchema.parse(rawId)
  const pack = DREAM_PACKS[rawPack]
  const price =
    process.env[rawPack === 1 ? 'STRIPE_PRICE_ONE' : 'STRIPE_PRICE_THREE']
  if (!price) throw new Error('Este pacote ainda não está disponível.')
  const mode = billingMode()
  const attribution = cleanAttribution(rawAttribution)
  const sql = getDb()
  const [count] =
    await sql`SELECT count(*)::int AS n FROM dream_orders WHERE user_id=${user.id} AND created_at>now()-interval '1 hour'`
  if (Number(count.n) >= 30)
    throw new Error(
      'Muitas tentativas. Aguarde um pouco antes de tentar de novo.',
    )
  await sql`INSERT INTO dream_orders(id,user_id,mode,credits,amount,price_id,attribution) VALUES(${id}::uuid,${user.id},${mode},${rawPack},${pack.amount},${price},${JSON.stringify(attribution)}::jsonb) ON CONFLICT DO NOTHING`
  const [order] =
    (await sql`SELECT * FROM dream_orders WHERE id=${id}::uuid`) as DreamOrder[]
  if (
    order.user_id !== user.id ||
    order.mode !== mode ||
    order.credits !== rawPack
  )
    throw new Error('Pedido inválido.')
  const stripe = getStripe()
  if (order.session_id) {
    const previous = await stripe.checkout.sessions.retrieve(order.session_id)
    if (previous.url && previous.status === 'open') return { url: previous.url }
    throw new Error(
      'Este checkout já foi encerrado. Escolha o pacote novamente.',
    )
  }
  const configuration = process.env.STRIPE_PAYMENT_CONFIGURATION
  if (!configuration)
    throw new Error('Métodos de pagamento ainda não configurados.')
  const methods =
    await stripe.paymentMethodConfigurations.retrieve(configuration)
  const enabled = Object.entries(methods)
    .filter(
      ([, value]) =>
        value &&
        typeof value === 'object' &&
        'display_preference' in value &&
        value.display_preference.value === 'on',
    )
    .map(([key]) => key)
  const allowed = billingConfig().pix ? ['card', 'pix'] : ['card']
  if (
    !methods.active ||
    enabled.some((method) => !allowed.includes(method)) ||
    allowed.some((method) => !enabled.includes(method))
  )
    throw new Error('Configuração de pagamentos divergente.')
  const safeSource = source === 'comecar' ? 'comecar' : 'account'
  const origin = billingOrigin()
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      locale: 'pt-BR',
      client_reference_id: user.id,
      customer_email: user.email,
      branding_settings: {
        display_name: 'Mandalart',
        background_color: '#f8fafc',
        button_color: '#6334ff',
        border_style: 'rounded',
        font_family: 'inter',
        ...(process.env.STRIPE_BRAND_ICON
          ? {
              icon: {
                type: 'file' as const,
                file: process.env.STRIPE_BRAND_ICON,
              },
            }
          : {}),
      },
      custom_text: {
        submit: {
          message: `${pack.label} para criar ${pack.credits === 1 ? 'seu planner completo' : 'seus planners completos'}. Pagamento único, sem assinatura.`,
        },
      },
      line_items: [{ price: order.price_id, quantity: 1 }],
      payment_method_configuration: configuration,
      payment_method_options: {
        card: { restrictions: { funding_types_blocked: ['debit', 'prepaid'] } },
      },
      wallet_options: { link: { display: 'never' } },
      metadata: { app: 'mandalart', order_id: id, source: safeSource, ...cleanAttribution(order.attribution) },
      payment_intent_data: { metadata: { app: 'mandalart', order_id: id } },
      success_url: `${origin}/sonhos?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/sonhos?cancelado=1&pacote=${rawPack}&origem=${safeSource}`,
    },
    { idempotencyKey: `mandalart-checkout-${id}` },
  )
  await sql`UPDATE dream_orders SET session_id=${session.id} WHERE id=${id}::uuid`
  if (!session.url) throw new Error('Não foi possível abrir o checkout.')
  return { url: session.url }
}
export async function checkDreamPayment(sessionId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para consultar sua compra.')
  if (paymentProvider() === 'asaas' && !sessionId.startsWith('cs_')) {
    const id = idSchema.parse(sessionId)
    const [order] = await getDb()`SELECT session_id,asaas_pix_qr_id FROM dream_orders WHERE id=${id}::uuid AND user_id=${user.id} AND provider='asaas' AND mode=${billingMode()}`
    if (order?.asaas_pix_qr_id) return reconcileAsaasPix(id, user.id)
    if (!order?.session_id) throw new Error('Compra não encontrada nesta conta.')
    return reconcileAsaasCheckout(String(order.session_id), user.id)
  }
  if (!/^cs_(test_|live_)?[A-Za-z0-9]{10,250}$/.test(sessionId))
    throw new Error('Compra inválida.')
  const [order] =
    await getDb()`SELECT id FROM dream_orders WHERE session_id=${sessionId} AND user_id=${user.id} AND mode=${billingMode()}`
  if (!order) throw new Error('Compra não encontrada nesta conta.')
  return reconcileCheckout(sessionId, user.id)
}

export async function startDreamPix(rawPack: number, rawId: string, rawAttribution: Attribution = {}) {
  if (!directAsaasPixEnabled()) throw new Error('Pix direto indisponível neste ambiente.')
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para guardar seus sonhos na sua conta.')
  if (rawPack !== 1 && rawPack !== 3) throw new Error('Pacote inválido.')
  const id = idSchema.parse(rawId)
  const pack = DREAM_PACKS[rawPack]
  const price = `asaas:account:${rawPack}`
  const sql = getDb()
  const [count] = await sql`SELECT count(*)::int AS n FROM dream_orders WHERE user_id=${user.id} AND created_at>now()-interval '1 hour'`
  if (Number(count.n) >= 30) throw new Error('Muitas tentativas. Aguarde um pouco antes de tentar de novo.')
  await sql`INSERT INTO dream_orders(id,user_id,mode,provider,credits,amount,price_id,attribution)
    VALUES(${id}::uuid,${user.id},${billingMode()},'asaas',${rawPack},${pack.amount},${price},${JSON.stringify(cleanAttribution(rawAttribution))}::jsonb)
    ON CONFLICT DO NOTHING`
  const [order] = await sql`SELECT * FROM dream_orders WHERE id=${id}::uuid`
  if (!order || order.user_id !== user.id || order.mode !== billingMode() || order.provider !== 'asaas' || Number(order.credits) !== rawPack || Number(order.amount) !== pack.amount || order.price_id !== price || order.session_id || order.status !== 'pending')
    throw new Error('Pedido inválido.')
  if (order.asaas_pix_qr_id) {
    if (new Date(order.asaas_pix_expires_at as string).getTime() > Date.now()) return { url: `/pix?order_id=${id}` }
    throw new Error('Este Pix expirou. Escolha o pacote novamente.')
  }
  const qr = await createAsaasPixQr(id, pack.amount)
  const [saved] = await sql`UPDATE dream_orders SET asaas_pix_qr_id=${qr.id},asaas_pix_payload=${qr.payload},asaas_pix_image=${qr.image},asaas_pix_expires_at=now()+interval '1 hour',payment_method='PIX'
    WHERE id=${id}::uuid AND asaas_pix_qr_id IS NULL AND status='pending' RETURNING id`
  if (!saved) throw new Error('O Pix já foi iniciado. Atualize a página e tente novamente.')
  return { url: `/pix?order_id=${id}` }
}

async function startAsaasDreamCheckout(rawPack: number, rawId: string, source: 'comecar' | 'account', rawAttribution: Attribution) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para guardar seus sonhos na sua conta.')
  if (rawPack !== 1 && rawPack !== 3) throw new Error('Pacote inválido.')
  const id = idSchema.parse(rawId)
  const mode = billingMode()
  const pack = DREAM_PACKS[rawPack]
  const safeSource = source === 'comecar' ? 'comecar' : 'account'
  const price = `asaas:${safeSource}:${rawPack}`
  const sql = getDb()
  const [count] = await sql`SELECT count(*)::int AS n FROM dream_orders WHERE user_id=${user.id} AND created_at>now()-interval '1 hour'`
  if (Number(count.n) >= 30) throw new Error('Muitas tentativas. Aguarde um pouco antes de tentar de novo.')
  await sql`INSERT INTO dream_orders(id,user_id,mode,provider,credits,amount,price_id,attribution)
    VALUES(${id}::uuid,${user.id},${mode},'asaas',${rawPack},${pack.amount},${price},${JSON.stringify(cleanAttribution(rawAttribution))}::jsonb)
    ON CONFLICT DO NOTHING`
  const [order] = (await sql`SELECT * FROM dream_orders WHERE id=${id}::uuid`) as DreamOrder[]
  if (!order || order.user_id !== user.id || order.mode !== mode || (order as DreamOrder & { provider: string }).provider !== 'asaas' || order.credits !== rawPack || order.amount !== pack.amount || order.price_id !== price || order.status !== 'pending')
    throw new Error('Pedido inválido.')
  if (order.session_id) {
    if (Date.now() - new Date((order as DreamOrder & { created_at: Date | string }).created_at).getTime() < 60 * 60 * 1000)
      return { url: asaasCheckoutUrl(order.session_id) }
    throw new Error('Este checkout já foi encerrado. Escolha o pacote novamente.')
  }
  const checkout = await createAsaasCheckout({
    orderId: id,
    name: rawPack === 1 ? 'Mandalart completo' : '3 Mandalarts completos',
    description: 'Acesso digital · pagamento único',
    amount: pack.amount,
    successPath: `/sonhos?asaas_order=${id}`,
    cancelPath: `/sonhos?cancelado=1&pacote=${rawPack}&origem=${safeSource}`,
    expiredPath: `/sonhos?expirado=1&pacote=${rawPack}&origem=${safeSource}`,
  })
  await sql`UPDATE dream_orders SET session_id=${checkout.id} WHERE id=${id}::uuid AND session_id IS NULL`
  return { url: checkout.url }
}
