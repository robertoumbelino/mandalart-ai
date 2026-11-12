// Integração local: estorno, vínculo por compra e bloqueio de resultados persistidos.
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
process.loadEnvFile('.env.local')
const url = new URL(process.env.DATABASE_URL)
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Este teste só pode usar Postgres local.')
const client = new pg.Client({ connectionString: url.toString() })
await client.connect()
const user = randomUUID()
const other = randomUUID()
const data = JSON.stringify({ mainGoal: 'Objetivo de teste', subGoals: [] })
const q = async (sql, values = []) => (await client.query(sql, values)).rows
const order = async (owner = user, credits = 1, mode = 'test') => {
  const id = randomUUID()
  await q("INSERT INTO dream_orders(id,user_id,mode,credits,amount,price_id) VALUES($1,$2,$3,$4,$5,'test')", [id, owner, mode, credits, credits * 1000])
  await reconcile(id)
  return id
}
const reconcile = (id, refund = 0, disputed = false, revision = 1) => q("SELECT dream_reconcile_order($1,true,$2,$3,$4,'pending')", [id, refund, disputed, revision])
const reserve = async (id, orderId = null, owner = user, mode = 'test') => (await q('SELECT dream_reserve($1,$2,$3,$4,$5) AS r', [owner, mode, id, id, orderId]))[0].r
const complete = async (id, owner = user, mode = 'test') => (await q('SELECT dream_complete($1,$2,$3,$4::jsonb) AS r', [owner, mode, id, data]))[0].r
const savedPlan = async orderId => {
  const id = randomUUID()
  assert.equal((await reserve(id, orderId)).status, 'reserved')
  return { generation: id, plan: (await complete(id)).id }
}
const status = async id => (await q('SELECT status FROM mandalarts WHERE id=$1', [id]))[0].status
const statuses = async plans => {
  const result = []
  for (const plan of plans) result.push(await status(plan.plan))
  return result
}
try {
  await q('BEGIN')
  for (const id of [user, other]) await q("INSERT INTO users(id,email,name) VALUES($1,$2,'Access QA')", [id, `${id}@example.com`])
  const first = await order()
  const second = await order()
  const firstPlan = await savedPlan(first)
  const secondPlan = await savedPlan(second)
  assert.equal((await q('SELECT order_id FROM dream_generations WHERE id=$1', [firstPlan.generation]))[0].order_id, first)
  await reconcile(first, 1000)
  assert.equal(await status(firstPlan.plan), 'disabled', 'full refund disables only its own plan')
  assert.equal(await status(secondPlan.plan), 'active', 'other paid purchase stays active')
  assert.equal((await q('SELECT count(*)::int AS n FROM mandalarts WHERE user_id=$1', [user]))[0].n, 2, 'plans remain stored')
  assert.equal((await reserve(firstPlan.generation)).status, 'disabled', 'cached reservation cannot expose disabled data')
  assert.equal(await complete(firstPlan.generation), null, 'cached completion cannot expose disabled data')
  await reconcile(first, 1000)
  await reconcile(first, 0)
  assert.equal(await status(firstPlan.plan), 'disabled', 'duplicate and stale approval cannot restore access')
  await order() // Compensa a dívida do crédito já usado e reembolsado.
  const pack = await order(user, 3)
  const plans = []
  for (let i = 0; i < 3; i++) plans.push(await savedPlan(pack))
  await reconcile(pack, 1000)
  assert.deepEqual(await statuses(plans), ['active', 'active', 'disabled'], 'partial refund disables only the revoked slot')
  await reconcile(pack, 1000, true, 2)
  assert.deepEqual(await statuses(plans), ['disabled', 'disabled', 'disabled'])
  await q("UPDATE mandalarts SET disabled_reason='manual' WHERE id=$1", [plans[0].plan])
  await reconcile(pack, 1000, false, 3)
  assert.deepEqual(await statuses(plans), ['disabled', 'active', 'disabled'], 'won dispute preserves manual blocks and partial refund')
  // A nova compra paga a dívida dos créditos estornados já usados.
  await order(user, 3)
  await order(user, 3)
  const pendingOrder = await order()
  const pending = randomUUID()
  await reserve(pending, pendingOrder)
  await reconcile(pendingOrder, 1000)
  const before = (await q("SELECT balance FROM dream_wallets WHERE user_id=$1 AND mode='test'", [user]))[0].balance
  assert.equal(await complete(pending), null, 'refund during generation prevents saving')
  assert.equal((await q("SELECT balance FROM dream_wallets WHERE user_id=$1 AND mode='test'", [user]))[0].balance, before + 1, 'canceled reservation returns its held credit once')
  assert.equal(await complete(pending), null)
  const foreign = await order(other)
  assert.equal((await reserve(randomUUID(), foreign)).status, 'insufficient', 'foreign order cannot finance a plan')
  const live = await order(user, 1, 'live')
  assert.equal((await reserve(randomUUID(), live)).status, 'insufficient', 'order from another mode cannot finance a plan')
  const fifo = randomUUID()
  assert.equal((await reserve(fifo)).status, 'reserved')
  assert.ok((await q('SELECT order_id,order_credit FROM dream_generations WHERE id=$1', [fifo]))[0].order_id, 'generic generation records the credit source')
  const retryOrder = await order()
  const failed = randomUUID()
  await reserve(failed, retryOrder)
  await q("SELECT dream_fail($1,'test',$2)", [user, failed])
  const retry = randomUUID()
  assert.equal((await reserve(retry, retryOrder)).status, 'reserved', 'failed generation releases its order slot')
  // Simula um plano antigo e reexecuta a migration: backfill não altera o acesso.
  const legacyPlan = randomUUID()
  const legacyGeneration = randomUUID()
  await q('INSERT INTO mandalarts(id,user_id,main_goal,sub_goals) VALUES($1,$2,$3,$4::jsonb)', [legacyPlan, other, 'Antigo', '[]'])
  await q("INSERT INTO dream_generations(id,user_id,mode,input_hash,status,result) VALUES($1,$2,'test','legacy','completed',$3::jsonb)", [legacyGeneration, other, JSON.stringify({ id: legacyPlan })])
  await client.query(await readFile(new URL('../migrations/012_plan_access.sql', import.meta.url), 'utf8'))
  assert.equal((await q('SELECT order_id FROM dream_generations WHERE id=$1', [legacyGeneration]))[0].order_id, foreign)
  assert.equal(await status(legacyPlan), 'active')
  await reconcile(foreign, 1000)
  assert.equal(await status(legacyPlan), 'disabled', 'backfilled plan follows the historical order')
  const balances = await q(`SELECT w.balance,COALESCE(sum(l.delta),0)::int AS ledger
    FROM dream_wallets w LEFT JOIN dream_credit_ledger l ON l.user_id=w.user_id AND l.mode=w.mode
    WHERE w.user_id=$1 GROUP BY w.user_id,w.mode,w.balance`, [user])
  for (const row of balances) assert.equal(row.balance, row.ledger, 'wallet remains consistent with ledger')
  console.log('Acesso por compra, reembolso integral/parcial, disputa, idempotência, geração em andamento, recuperação, isolamento, falha e backfill: OK.')
} finally {
  await q('ROLLBACK')
  await client.end()
}
