// Integração real com Postgres local: concorrência e idempotência não podem ser provadas com mocks.
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
process.loadEnvFile('.env.local')
const url = new URL(process.env.DATABASE_URL)
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('Este teste só pode usar Postgres local.')
const pool = new pg.Pool({ connectionString: url.toString(), max: 8 })
const user = randomUUID()
const query = (text, values = []) => pool.query(text, values)
const balance = async (mode = 'test') =>
  Number(
    (
      await query('SELECT dream_release_expired($1,$2) AS balance', [
        user,
        mode,
      ])
    ).rows[0].balance,
  )
const order = async (credits = 1) => {
  const id = randomUUID()
  await query(
    "INSERT INTO dream_orders(id,user_id,mode,credits,amount,price_id) VALUES($1,$2,'test',$3,$4,'price_test')",
    [id, user, credits, credits === 1 ? 3990 : 9990],
  )
  return id
}
const reconcile = (
  id,
  paid = true,
  refund = 0,
  dispute = false,
  revision = 1,
  status = 'pending',
) =>
  query('SELECT dream_reconcile_order($1,$2,$3,$4,$5,$6)', [
    id,
    paid,
    refund,
    dispute,
    revision,
    status,
  ])
const reserve = async (id = randomUUID(), hash = 'goal') =>
  (await query("SELECT dream_reserve($1,'test',$2,$3) AS r", [user, id, hash]))
    .rows[0].r
try {
  await query(
    "INSERT INTO users(id,email,name,password_hash) VALUES($1,$2,'Billing QA','not-a-login')",
    [user, `credits-${user}@example.com`],
  )
  const single = await order()
  await reconcile(single, false)
  assert.equal(await balance(), 0, 'pending payment must not credit')
  await Promise.all(Array.from({ length: 8 }, () => reconcile(single)))
  assert.equal(
    await balance(),
    1,
    'duplicate concurrent fulfillment must credit once',
  )
  assert.equal(
    await balance('live'),
    0,
    'test credits cannot enter live wallet',
  )
  const ids = Array.from({ length: 8 }, () => randomUUID())
  const reservations = await Promise.all(ids.map((id) => reserve(id)))
  assert.equal(
    reservations.filter((r) => r.status === 'reserved').length,
    1,
    'only one generation can reserve last credit',
  )
  const reservedId = ids[reservations.findIndex((r) => r.status === 'reserved')]
  assert.equal(
    (await reserve(reservedId)).status,
    'generating',
    'retry must not reserve twice',
  )
  await assert.rejects(
    () => reserve(reservedId, 'changed goal'),
    'id reuse with other payload must fail',
  )
  await Promise.all(
    Array.from({ length: 4 }, () =>
      query("SELECT dream_fail($1,'test',$2)", [user, reservedId]),
    ),
  )
  assert.equal(await balance(), 1, 'failure refunds once')
  const expired = randomUUID()
  await reserve(expired)
  await query(
    "UPDATE dream_generations SET expires_at=now()-interval '1 second' WHERE id=$1",
    [expired],
  )
  assert.equal(await balance(), 1, 'timeout restores credit')
  const data = { mainGoal: 'Objetivo', subGoals: [] }
  const late = (
    await query("SELECT dream_complete($1,'test',$2,$3::jsonb) AS r", [
      user,
      expired,
      JSON.stringify(data),
    ])
  ).rows[0].r
  assert.equal(late, null, 'late AI completion cannot save after refund')
  const complete = randomUUID()
  await reserve(complete)
  const completeQuery = () =>
    query("SELECT dream_complete($1,'test',$2,$3::jsonb) AS r", [
      user,
      complete,
      JSON.stringify(data),
    ])
  const saved = (await completeQuery()).rows[0].r
  assert.equal(
    (await completeQuery()).rows[0].r.id,
    saved.id,
    'duplicate completion must return same saved planner',
  )
  await query("SELECT dream_fail($1,'test',$2)", [user, complete])
  assert.equal(await balance(), 0, 'completed generation must never refund')
  assert.equal(
    (
      await query(
        'SELECT count(*)::int AS n FROM mandalarts WHERE user_id=$1',
        [user],
      )
    ).rows[0].n,
    1,
  )
  await reconcile(single, true, 3990, false, 2)
  await reconcile(single, true, 0, false, 1)
  assert.equal(
    await balance(),
    -1,
    'refunded spent credits become debt; stale success cannot regrant',
  )
  const three = await order(3)
  await reconcile(three)
  assert.equal(await balance(), 2)
  await reconcile(three, true, 3330, false, 2)
  assert.equal(
    await balance(),
    1,
    'partial refund revokes proportional rounded-up credits',
  )
  await reconcile(three, true, 3330, true, 3)
  assert.equal(await balance(), -1, 'dispute holds remaining credits')
  await reconcile(three, true, 3330, false, 2)
  assert.equal(await balance(), -1, 'older dispute state cannot unlock credits')
  await reconcile(three, true, 3330, false, 4)
  assert.equal(
    await balance(),
    1,
    'won dispute restores only nonrefunded credits',
  )
  const ledger = (
    await query(
      "SELECT sum(delta)::int AS total FROM dream_credit_ledger WHERE user_id=$1 AND mode='test'",
      [user],
    )
  ).rows[0].total
  assert.equal(ledger, await balance(), 'ledger and wallet must match')
  console.log(
    '18 cenários de integridade financeira passaram no Postgres local.',
  )
} finally {
  await query('DELETE FROM users WHERE id=$1', [user])
  await pool.end()
}
