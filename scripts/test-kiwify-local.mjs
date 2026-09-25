// Exercita a rota HTTP e a carteira com eventos sintéticos, sem compra real.
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import pg from 'pg'

process.loadEnvFile('.env.local')
const database = new URL(process.env.DATABASE_URL)
if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname))
  throw new Error('Este teste só pode usar Postgres local.')
if (process.env.KIWIFY_ONBOARDING_ENABLED === 'true')
  throw new Error('Desative o checkout Kiwify para este teste sintético.')
const base = new URL(process.env.KIWIFY_TEST_BASE_URL || 'http://localhost:3001')
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
  throw new Error('Este teste só pode chamar o servidor local.')

const token = 'local-kiwify-fixture'
const productId = process.env.KIWIFY_PRODUCT_ID
const checkoutCode = new URL(process.env.KIWIFY_CHECKOUT_ONE).pathname.slice(1)
const user = randomUUID()
const order = randomUUID()
const sale = randomUUID()
const client = new pg.Client({ connectionString: database.toString() })
await client.connect()

async function balance() {
  const result = await client.query(
    "SELECT balance FROM dream_wallets WHERE user_id=$1 AND mode='test'",
    [user],
  )
  return Number(result.rows[0]?.balance || 0)
}

async function send(event, validSignature = true) {
  const body = JSON.stringify(event)
  const signature = validSignature
    ? createHmac('sha1', token).update(body).digest('hex')
    : '0'.repeat(40)
  return fetch(new URL(`/api/kiwify/webhook?signature=${signature}`, base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

const event = {
  order_id: sale,
  order_status: 'paid',
  webhook_event_type: 'order_approved',
  Product: { product_id: productId },
  Commissions: {
    charge_amount: '3990',
    currency: 'BRL',
    product_base_price: '3990',
    product_base_price_currency: 'BRL',
  },
  TrackingParameters: { sck: order },
  checkout_link: checkoutCode,
}

try {
  await client.query(
    "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,'Kiwify QA','not-a-login')",
    [user, `kiwify-${user}@example.com`],
  )
  await client.query(
    "INSERT INTO dream_orders(id,user_id,mode,provider,credits,amount,price_id) VALUES($1,$2,'test','kiwify',1,3990,$3)",
    [order, user, checkoutCode],
  )
  assert.equal((await send(event, false)).status, 400)
  assert.equal(await balance(), 0)
  assert.equal((await send({ ...event, Product: { product_id: randomUUID() } })).status, 200)
  assert.equal(await balance(), 0)
  const approvals = await Promise.all(Array.from({ length: 5 }, () => send(event)))
  assert(approvals.every((response) => response.status === 200))
  assert.equal(await balance(), 1, 'repeated approval must credit once')
  assert.equal(
    (await send({ ...event, order_status: 'refunded', webhook_event_type: 'order_refunded' })).status,
    200,
  )
  assert.equal(await balance(), 0, 'refund must remove the credit')
  assert.equal((await send(event)).status, 200)
  assert.equal(await balance(), 0, 'late approval cannot restore a refunded credit')

  const disputedOrder = randomUUID()
  const disputedSale = randomUUID()
  await client.query(
    "INSERT INTO dream_orders(id,user_id,mode,provider,credits,amount,price_id) VALUES($1,$2,'test','kiwify',1,3990,$3)",
    [disputedOrder, user, checkoutCode],
  )
  const disputedEvent = {
    ...event,
    order_id: disputedSale,
    TrackingParameters: { sck: disputedOrder },
  }
  assert.equal((await send(disputedEvent)).status, 200)
  assert.equal(await balance(), 1)
  assert.equal((await send({ ...disputedEvent, webhook_event_type: 'chargeback', order_status: 'chargedback' })).status, 200)
  assert.equal(await balance(), 0, 'chargeback must remove the credit')
  assert.equal((await send(disputedEvent)).status, 200)
  assert.equal(await balance(), 0, 'late approval cannot clear a chargeback')
  console.log('Kiwify local HTTP and wallet test passed')
} finally {
  await client.query('DELETE FROM users WHERE id=$1', [user])
  await client.end()
}
