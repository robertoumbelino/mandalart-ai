import { readFile, writeFile } from 'node:fs/promises'
import Stripe from 'stripe'
process.loadEnvFile('.env.local')
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))
  throw new Error('Use uma chave de teste.')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const products = await stripe.products.list({ active: true, limit: 100 })
let product = products.data.find(
  (p) => p.metadata.app === 'mandalart' && p.metadata.kind === 'dream_credits',
)
product ||= await stripe.products.create(
  {
    name: 'Sonhos Mandalart',
    description:
      '8 caminhos, 64 tarefas com checklists e progresso salvo para um objetivo. Pagamento único · Garantia de 7 dias',
    metadata: { app: 'mandalart', kind: 'dream_credits' },
  },
  { idempotencyKey: 'mandalart-dream-product-v1' },
)
await stripe.products.update(product.id, { description: '8 caminhos, 64 tarefas com checklists e progresso salvo para um objetivo. Pagamento único · Garantia de 7 dias' })
let env = await readFile('.env.local', 'utf8')
const set = (name, value) => {
  env = env.replace(new RegExp('^' + name + '=.*\\n?', 'm'), '')
  env += `\n${name}=${value}\n`
}
for (const [credits, amount, key] of [
  [1, 3700, 'STRIPE_PRICE_ONE'],
  [3, 9990, 'STRIPE_PRICE_THREE'],
]) {
  const lookup_key = `mandalart_dreams_${credits}_brl_${amount}`
  const existing = await stripe.prices.list({
    lookup_keys: [lookup_key],
    active: true,
  })
  const price =
    existing.data[0] ||
    (await stripe.prices.create(
      {
        product: product.id,
        unit_amount: amount,
        currency: 'brl',
        nickname: `${credits} sonho${credits > 1 ? 's' : ''}`,
        lookup_key,
        metadata: { credits: String(credits), app: 'mandalart' },
      },
      { idempotencyKey: lookup_key },
    ))
  set(key, price.id)
  console.log(
    `${credits} sonho(s): R$ ${(amount / 100).toFixed(2)} — ${price.id}`,
  )
}
let bumpProduct = products.data.find(
  (p) => p.metadata.app === 'mandalart' && p.metadata.kind === 'dream_bump_2',
)
bumpProduct ||= await stripe.products.create({
  name: 'Adicionar mais 2 Mandalarts',
  description: 'Dois Mandalarts completos adicionais, para organizar outros sonhos depois.',
  metadata: { app: 'mandalart', kind: 'dream_bump_2' },
}, { idempotencyKey: 'mandalart-bump-product-v1' })
const bumpKey = 'mandalart_bump_2_brl_6200'
const bumpPrices = await stripe.prices.list({ lookup_keys: [bumpKey], active: true })
const bumpPrice = bumpPrices.data[0] || await stripe.prices.create({
  product: bumpProduct.id,
  unit_amount: 6200,
  currency: 'brl',
  nickname: 'Mais 2 Mandalarts',
  lookup_key: bumpKey,
  metadata: { app: 'mandalart', credits: '2', kind: 'dream_bump_2' },
}, { idempotencyKey: bumpKey })
set('STRIPE_PRICE_BUMP', bumpPrice.id)
console.log(`Adicional de 2 sonhos: R$ 62,00 — ${bumpPrice.id}`)
const configurations = (
  await stripe.paymentMethodConfigurations.list({ limit: 100 })
).data
const defaultConfig = configurations.find((config) => config.is_default)
if (!defaultConfig) throw new Error('Configuração padrão não encontrada.')
const configName = 'Mandalart — cartão e Pix'
const methodSettings = { name: configName }
for (const [key, value] of Object.entries(defaultConfig)) {
  if (value && typeof value === 'object' && 'display_preference' in value)
    methodSettings[key] = {
      display_preference: { preference: key === 'card' ? 'on' : 'off' },
    }
}
const existingConfig = configurations.find(
  (config) => config.name === configName,
)
const config = existingConfig
  ? await stripe.paymentMethodConfigurations.update(
      existingConfig.id,
      methodSettings,
    )
  : await stripe.paymentMethodConfigurations.create(methodSettings)
set('STRIPE_PAYMENT_CONFIGURATION', config.id)
if (!process.env.STRIPE_BRAND_ICON) {
  const icon = await stripe.files.create({
    purpose: 'business_icon',
    file: {
      data: await readFile('public/mandalart-logo.png'),
      name: 'mandalart-logo.png',
      type: 'image/png',
    },
  })
  set('STRIPE_BRAND_ICON', icon.id)
}
set('APP_URL', 'http://localhost:3000')
set('STRIPE_PIX_ENABLED', 'false')
await writeFile('.env.local', env, { mode: 0o600 })
console.log(
  'Produtos de teste configurados. Pix desativado até liberação da conta.',
)
