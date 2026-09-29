import Stripe from 'stripe'
process.loadEnvFile('.env.local')
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Somente Stripe test mode.')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ONE)
const productId = typeof price.product === 'string' ? price.product : price.product.id
await stripe.products.update(productId, { description: '8 caminhos, 64 tarefas com checklists e progresso salvo para um objetivo. Pagamento único · Garantia de 7 dias' })
console.log('Descrição atualizada somente no produto de teste. Preços preservados.')
