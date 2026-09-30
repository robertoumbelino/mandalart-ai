'use server'

import { getPaymentOptions, startDreamCheckout } from '@/actions/payments'
import { getCurrentUser } from '@/actions/auth'
import { getDb } from '@/lib/db'
import { DREAM_PACKS } from '@/lib/dream-packs'
import { kiwifyCheckoutLink } from '@/lib/kiwify-checkout'
import { kiwifyOnboardingEnabled } from '@/lib/kiwify'
import { billingMode, paymentProvider } from '@/lib/stripe'
import { z } from 'zod'
import { previewProgressSchema } from '@/lib/preview-progress'
import { idSchema } from '@/lib/validation'
import { cleanAttribution, type Attribution } from '@/lib/attribution'
import { getPreviewSession } from '@/lib/onboarding-server'
import { billingOrigin, getStripe } from '@/lib/stripe'
import { createAsaasCheckout, asaasCheckoutUrl, createAsaasPixQr, directAsaasPixEnabled } from '@/lib/asaas'

const guestContextSchema = z.object({ checked: previewProgressSchema.optional(), bump: z.boolean().default(false), marketingConsent: z.boolean().default(false), analyticsDistinctId: z.string().min(1).max(200).optional() })

// The preview itself is the product being purchased. No auth account exists yet.
export async function startGuestCheckout(rawPreviewId: string, rawOrderId: string, rawContext: unknown = {}) {
  const context = guestContextSchema.parse(rawContext)
  const previewId = idSchema.parse(rawPreviewId)
  const orderId = idSchema.parse(rawOrderId)
  const sessionId = await getPreviewSession()
  const sql = getDb()
  const [preview] = await sql`SELECT p.id,p.attribution,l.id AS lead_id,l.email
    FROM onboarding_previews p
    LEFT JOIN LATERAL (
      SELECT id,email FROM onboarding_leads
      WHERE preview_id=p.id AND session_id=p.session_id
      ORDER BY created_at DESC LIMIT 1
    ) l ON true
    WHERE p.id=${previewId}::uuid AND p.status='ready'
      AND p.expires_at>now() AND p.session_id=${sessionId}::uuid`
  if (!preview) throw new Error('Abra sua prévia antes de continuar para o pagamento.')
  if (paymentProvider() === 'asaas')
    return startAsaasGuestCheckout({ preview: preview as { lead_id: string | null; email: string | null; attribution: unknown }, previewId, orderId, sessionId, context })
  const mode = billingMode()
  const price = process.env.STRIPE_PRICE_ONE
  if (!price) throw new Error('Checkout indisponível no momento.')
  const [count] = await sql`SELECT count(*)::int AS n FROM dream_orders WHERE preview_id=${previewId}::uuid AND created_at>now()-interval '1 hour'`
  if (Number(count.n) >= 10) throw new Error('Muitas tentativas. Aguarde um pouco antes de tentar de novo.')
  await sql`INSERT INTO dream_orders(id,user_id,mode,credits,amount,price_id,lead_id,preview_id,guest_email,bump_price_id,attribution,marketing_consent,journey_version,analytics_distinct_id)
    VALUES(${orderId}::uuid,NULL,${mode},1,3700,${price},${preview.lead_id || null}::uuid,${previewId}::uuid,${preview.email || null},${process.env.STRIPE_PRICE_BUMP || null},${JSON.stringify(cleanAttribution(preview.attribution))}::jsonb,${context.marketingConsent},'conversion-v2',${context.analyticsDistinctId || null})
    ON CONFLICT DO NOTHING`
  const [order] = await sql`SELECT * FROM dream_orders WHERE id=${orderId}::uuid`
  if (!order || order.lead_id !== (preview.lead_id || null) || order.preview_id !== previewId || order.mode !== mode || order.price_id !== price || order.guest_email !== (preview.email || null)) throw new Error('Pedido inválido.')
  if (context.checked) await sql`UPDATE onboarding_previews SET checked=${JSON.stringify(context.checked)}::jsonb WHERE id=${previewId}::uuid AND session_id=${sessionId}::uuid`
  const stripe = getStripe()
  if (order.session_id) {
    const previous = await stripe.checkout.sessions.retrieve(String(order.session_id))
    if (previous.url && previous.status === 'open') return { url: previous.url }
    throw new Error('Este checkout foi encerrado. Tente novamente.')
  }
  const options = await getPaymentOptions()
  if (!options.available) throw new Error('Pagamentos temporariamente indisponíveis. Sua prévia continua salva.')
  const bumpPrice = process.env.STRIPE_PRICE_BUMP
  const [baseOffer, bumpOffer] = await Promise.all([
    stripe.prices.retrieve(price),
    bumpPrice ? stripe.prices.retrieve(bumpPrice) : Promise.resolve(null),
  ])
  if (!baseOffer.active || baseOffer.currency !== 'brl' || baseOffer.unit_amount !== 3700 || baseOffer.type !== 'one_time'
    || (bumpOffer && (!bumpOffer.active || bumpOffer.currency !== 'brl' || bumpOffer.unit_amount !== 6200 || bumpOffer.type !== 'one_time')))
    throw new Error('Oferta indisponível no momento. Tente novamente mais tarde.')
  const configuration = process.env.STRIPE_PAYMENT_CONFIGURATION
  if (!configuration) throw new Error('Métodos de pagamento indisponíveis.')
  const origin = billingOrigin()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', locale: 'pt-BR', client_reference_id: orderId,
    ...(preview.email ? { customer_email: String(preview.email) } : {}),
    line_items: [{ price, quantity: 1 }, ...(context.bump && bumpPrice ? [{ price: bumpPrice, quantity: 1 }] : [])],
    ...(bumpPrice && !context.bump ? { optional_items: [{ price: bumpPrice, quantity: 1 }] } : {}),
    payment_method_configuration: configuration,
    wallet_options: { link: { display: 'never' } },
    branding_settings: { ...(process.env.STRIPE_BRAND_ICON ? { icon: { type: 'file' as const, file: process.env.STRIPE_BRAND_ICON } } : {}), display_name: 'Mandalart', background_color: '#f8fafc', button_color: '#6334ff', border_style: 'rounded', font_family: 'inter' },
    custom_text: { submit: { message: '8 caminhos com ações, checklists e progresso salvo. Pagamento único · Garantia de 7 dias' } },
    metadata: { app: 'mandalart', order_id: orderId, source: 'comecar', ...cleanAttribution(preview.attribution) },
    payment_intent_data: { metadata: { app: 'mandalart', order_id: orderId } },
    success_url: `${origin}/compra?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/comecar?cancelado=1`,
  }, { idempotencyKey: `mandalart-guest-${orderId}` })
  if (!session.url) throw new Error('Não foi possível abrir o checkout.')
  await sql`UPDATE dream_orders SET session_id=${session.id} WHERE id=${orderId}::uuid`
  await sql`INSERT INTO onboarding_events(session_id,lead_id,order_id,name,attribution,preview_id,properties)
    VALUES(${sessionId}::uuid,${preview.lead_id || null}::uuid,${orderId}::uuid,'checkout_started',${JSON.stringify(cleanAttribution(preview.attribution))}::jsonb,${previewId}::uuid,'{"journey_version":"conversion-v2"}'::jsonb)`
  return { url: session.url }
}

export async function startGuestPix(rawPreviewId: string, rawOrderId: string, rawEmail: string, rawContext: unknown = {}) {
  if (!directAsaasPixEnabled()) throw new Error('Pix direto indisponível neste ambiente.')
  const context = guestContextSchema.parse(rawContext)
  const email = z.email().max(254).parse(rawEmail.trim().toLowerCase())
  const previewId = idSchema.parse(rawPreviewId)
  const orderId = idSchema.parse(rawOrderId)
  const sessionId = await getPreviewSession()
  const sql = getDb()
  const [preview] = await sql`SELECT p.id,p.attribution,l.id AS lead_id,l.email
    FROM onboarding_previews p
    LEFT JOIN LATERAL (
      SELECT id,email FROM onboarding_leads WHERE preview_id=p.id AND session_id=p.session_id ORDER BY created_at DESC LIMIT 1
    ) l ON true
    WHERE p.id=${previewId}::uuid AND p.status='ready' AND p.expires_at>now() AND p.session_id=${sessionId}::uuid`
  if (!preview) throw new Error('Abra sua prévia antes de continuar para o pagamento.')
  const leadId = preview.email === email ? preview.lead_id : null
  const credits = context.bump ? 3 : 1
  const amount = context.bump ? 9900 : 3700
  const price = `asaas:guest:${credits}`
  const [count] = await sql`SELECT count(*)::int AS n FROM dream_orders WHERE preview_id=${previewId}::uuid AND created_at>now()-interval '1 hour'`
  if (Number(count.n) >= 10) throw new Error('Muitas tentativas. Aguarde um pouco antes de tentar de novo.')
  await sql`INSERT INTO dream_orders(id,user_id,mode,provider,credits,amount,price_id,lead_id,preview_id,guest_email,attribution,marketing_consent,journey_version,analytics_distinct_id)
    VALUES(${orderId}::uuid,NULL,${billingMode()},'asaas',${credits},${amount},${price},${leadId}::uuid,${previewId}::uuid,${email},${JSON.stringify(cleanAttribution(preview.attribution))}::jsonb,${context.marketingConsent},'conversion-v2',${context.analyticsDistinctId || null})
    ON CONFLICT DO NOTHING`
  const [order] = await sql`SELECT * FROM dream_orders WHERE id=${orderId}::uuid`
  if (!order || order.provider !== 'asaas' || order.mode !== billingMode() || order.preview_id !== previewId || order.guest_email !== email || Number(order.credits) !== credits || Number(order.amount) !== amount || order.price_id !== price || order.session_id || order.status !== 'pending')
    throw new Error('Pedido inválido.')
  if (context.checked) await sql`UPDATE onboarding_previews SET checked=${JSON.stringify(context.checked)}::jsonb WHERE id=${previewId}::uuid AND session_id=${sessionId}::uuid`
  if (order.asaas_pix_qr_id) {
    if (new Date(order.asaas_pix_expires_at as string).getTime() > Date.now()) return { url: `/pix?order_id=${orderId}` }
    throw new Error('Este Pix expirou. Inicie uma nova compra.')
  }
  const qr = await createAsaasPixQr(orderId, amount)
  const [saved] = await sql`UPDATE dream_orders SET asaas_pix_qr_id=${qr.id},asaas_pix_payload=${qr.payload},asaas_pix_image=${qr.image},asaas_pix_expires_at=now()+interval '1 hour'
    WHERE id=${orderId}::uuid AND asaas_pix_qr_id IS NULL AND status='pending' RETURNING id`
  if (!saved) throw new Error('O Pix já foi iniciado. Atualize a página e tente novamente.')
  await sql`INSERT INTO onboarding_events(session_id,lead_id,order_id,name,attribution,preview_id,properties)
    VALUES(${sessionId}::uuid,${leadId}::uuid,${orderId}::uuid,'checkout_started',${JSON.stringify(cleanAttribution(preview.attribution))}::jsonb,${previewId}::uuid,${JSON.stringify({ journey_version: 'conversion-v2', method: 'pix' })}::jsonb)`
  return { url: `/pix?order_id=${orderId}` }
}

async function startAsaasGuestCheckout(input: {
  preview: { lead_id: string | null; email: string | null; attribution: unknown }
  previewId: string
  orderId: string
  sessionId: string
  context: { bump: boolean; checked?: z.infer<typeof previewProgressSchema>; marketingConsent: boolean; analyticsDistinctId?: string }
}) {
  const { preview, previewId, orderId, sessionId, context } = input
  const sql = getDb()
  const mode = billingMode()
  const credits = context.bump ? 3 : 1
  const amount = context.bump ? 9900 : 3700
  const price = `asaas:guest:${credits}`
  const [count] = await sql`SELECT count(*)::int AS n FROM dream_orders WHERE preview_id=${previewId}::uuid AND created_at>now()-interval '1 hour'`
  if (Number(count.n) >= 10) throw new Error('Muitas tentativas. Aguarde um pouco antes de tentar de novo.')
  await sql`INSERT INTO dream_orders(id,user_id,mode,provider,credits,amount,price_id,lead_id,preview_id,guest_email,attribution,marketing_consent,journey_version,analytics_distinct_id)
    VALUES(${orderId}::uuid,NULL,${mode},'asaas',${credits},${amount},${price},${preview.lead_id || null}::uuid,${previewId}::uuid,${preview.email || null},${JSON.stringify(cleanAttribution(preview.attribution))}::jsonb,${context.marketingConsent},'conversion-v2',${context.analyticsDistinctId || null})
    ON CONFLICT DO NOTHING`
  const [order] = await sql`SELECT * FROM dream_orders WHERE id=${orderId}::uuid`
  if (!order || order.provider !== 'asaas' || order.lead_id !== (preview.lead_id || null) || order.preview_id !== previewId || order.mode !== mode || order.price_id !== price || order.guest_email !== (preview.email || null) || order.status !== 'pending')
    throw new Error('Pedido inválido.')
  if (context.checked) await sql`UPDATE onboarding_previews SET checked=${JSON.stringify(context.checked)}::jsonb WHERE id=${previewId}::uuid AND session_id=${sessionId}::uuid`
  if (order.session_id) {
    if (Date.now() - new Date(order.created_at as Date | string).getTime() < 60 * 60 * 1000)
      return { url: asaasCheckoutUrl(String(order.session_id)) }
    throw new Error('Este checkout foi encerrado. Tente novamente.')
  }
  const checkout = await createAsaasCheckout({
    orderId,
    name: context.bump ? 'Mandalart + 2 sonhos' : 'Mandalart completo',
    description: 'Planner digital · pagamento único · garantia de 7 dias',
    amount,
    successPath: `/compra?order_id=${orderId}`,
    cancelPath: '/comecar?cancelado=1',
    expiredPath: '/comecar?expirado=1',
  })
  await sql`UPDATE dream_orders SET session_id=${checkout.id} WHERE id=${orderId}::uuid AND session_id IS NULL`
  await sql`INSERT INTO onboarding_events(session_id,lead_id,order_id,name,attribution,preview_id,properties)
    VALUES(${sessionId}::uuid,${preview.lead_id || null}::uuid,${orderId}::uuid,'checkout_started',${JSON.stringify(cleanAttribution(preview.attribution))}::jsonb,${previewId}::uuid,'{"journey_version":"conversion-v2"}'::jsonb)`
  return { url: checkout.url }
}

// Ponto exclusivo do funil /comecar. Compras iniciadas pela conta usam o provedor ativo.
export async function getOnboardingPaymentOptions() {
  if (process.env.KIWIFY_ONBOARDING_ENABLED === 'true') {
    return {
      available: kiwifyOnboardingEnabled(),
      provider: 'kiwify' as const,
      mode: billingMode(),
      pix: false,
      directPix: false,
    }
  }
  return getPaymentOptions()
}

export async function startOnboardingCheckout(pack: number, id: string, rawAttribution: Attribution = {}) {
  const attribution = cleanAttribution(rawAttribution)
  if (process.env.KIWIFY_ONBOARDING_ENABLED !== 'true')
    return startDreamCheckout(pack, id, 'comecar', attribution)
  if (!kiwifyOnboardingEnabled())
    throw new Error('Checkout da Kiwify ainda não disponível.')

  const user = await getCurrentUser()
  if (!user) throw new Error('Faça login para guardar seus sonhos na sua conta.')
  if (pack !== 1 && pack !== 3) throw new Error('Pacote inválido.')
  const orderId = idSchema.parse(id)
  const offer = DREAM_PACKS[pack]
  const url = kiwifyCheckoutLink(pack, user.email, orderId, attribution)
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
    INSERT INTO dream_orders(id,user_id,mode,provider,credits,amount,price_id,attribution)
    VALUES(${orderId}::uuid,${user.id},${mode},'kiwify',${pack},${offer.amount},${checkoutCode},${JSON.stringify(attribution)}::jsonb)
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
    SELECT id, status, credited, amount, mode FROM dream_orders
    WHERE id=${id}::uuid AND user_id=${user.id} AND mode=${billingMode()} AND provider='kiwify'
  `
  if (!order) throw new Error('Compra não encontrada nesta conta.')
  return { id: String(order.id), status: String(order.status), credits: Number(order.credited), amount: Number(order.amount), mode: String(order.mode) }
}
