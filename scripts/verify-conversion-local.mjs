// Run after the browser sandbox purchase with delivered+conversion@resend.dev.
import pg from 'pg'
import Stripe from 'stripe'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
process.loadEnvFile('.env.local')
const origin = process.env.QA_APP_URL || 'http://localhost:3100'
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)
  || !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)
  || !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) throw new Error('Local + sandbox only.')
const sql = new pg.Client({ connectionString: process.env.DATABASE_URL })
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
await sql.connect()
try {
  const { rows: orders } = await sql.query("SELECT * FROM dream_orders WHERE guest_email=$1 AND mode='test' AND status='paid' ORDER BY created_at", ['delivered+conversion@resend.dev'])
  assert.ok(orders.some(o => o.amount === 3700 && o.credited === 1))
  assert.ok(orders.some(o => o.amount === 9900 && o.credited === 3))
  assert.equal(new Set(orders.map(o => o.user_id)).size, 1, 'same email must not create another account')
  const userId = orders[0].user_id
  const balance = async () => (await sql.query("SELECT balance FROM dream_wallets WHERE user_id=$1 AND mode='test'", [userId])).rows[0].balance
  const before = await balance()
  const events = await stripe.events.list({ type: 'checkout.session.completed', limit: 100 })
  for (const order of orders) {
    assert.ok(order.access_email_sent_at, 'provider must have accepted access email')
    const event = events.data.find(e => e.data.object.id === order.session_id)
    assert.ok(event, 'must have an actual Stripe event')
    const payload = JSON.stringify(event)
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET })
    const responses = await Promise.all(Array.from({ length: 3 }, () => fetch(`${origin}/api/stripe/webhook`, { method: 'POST', headers: { 'stripe-signature': signature }, body: payload })))
    assert.ok(responses.every(r => r.ok), 'duplicate webhooks must succeed')
    const { rows } = await sql.query("SELECT count(*)::int AS n FROM onboarding_events WHERE order_id=$1 AND name='purchase_completed'", [order.id])
    assert.equal(rows[0].n, 1, 'one purchase event per order')
  }
  assert.equal(await balance(), before, 'duplicate webhooks must not add credits')
  const { rows: generations } = await sql.query("SELECT result FROM dream_generations WHERE user_id=$1 AND status='completed' ORDER BY created_at", [userId])
  assert.ok(generations.length > 0)
  const plan = generations[0].result.data
  assert.deepEqual(plan.subGoals[0].tasks[0].checklist.map(c => c.checked), [true,true,true])
  assert.equal(plan.subGoals[0].tasks[0].isCompleted, true)
  assert.equal(plan.subGoals[0].tasks[1].isCompleted, false)
  const { rows: storedEvents } = await sql.query("SELECT DISTINCT name FROM onboarding_events WHERE session_id=(SELECT session_id FROM onboarding_previews WHERE id=$1)", [orders[0].preview_id])
  const names = storedEvents.map(e=>e.name)
  for (const name of ['preview_viewed','offer_viewed','email_block_viewed','email_captured','checkout_started','purchase_completed']) assert.ok(names.includes(name), name)
  // Redeem the exact deterministic token sent by sendAccessEmail, without reusing a browser cookie.
  const order = orders.at(-1)
  const token = createHmac('sha256',process.env.JWT_SECRET).update(`purchase-access:${order.id}:${userId}`).digest('base64url')
  const accessUrl = `${origin}/api/access/redeem?token=${token}`
  const get = await fetch(accessUrl)
  assert.equal(get.status, 200, 'scanner GET must not consume token')
  const post = await fetch(accessUrl, { method:'POST', headers:{origin, 'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({token}), redirect:'manual' })
  assert.equal(post.status, 303)
  assert.equal(post.headers.get('location'), `${origin}/?continuar=sonho`)
  assert.ok(post.headers.get('set-cookie')?.includes('mandalart_email_access='))
  const replay = await fetch(accessUrl, { method:'POST', headers:{origin, 'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({token}), redirect:'manual' })
  assert.equal(replay.status, 410, 'one-time access must reject replay')
  const report = { checkedAt: new Date().toISOString(), orders: orders.map(o=>({id:o.id,amount:o.amount,credits:o.credited,newAccount:o.browser_access_granted,emailAccepted:!!o.access_email_sent_at})), walletBeforeReplay:before,walletAfterReplay:await balance(),previewChecksPreserved:true,emailLinkRedeemed:true,emailLinkReplayStatus:replay.status,events:names }
  await mkdir('contents/conversion-qa',{recursive:true})
  await writeFile('contents/conversion-qa/results.json',JSON.stringify(report,null,2))
  console.log(JSON.stringify(report,null,2))
} finally { await sql.end() }
