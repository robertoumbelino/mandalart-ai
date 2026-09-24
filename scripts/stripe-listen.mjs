import { spawn } from 'node:child_process'
import { readFile, writeFile, access } from 'node:fs/promises'
import { homedir } from 'node:os'
process.loadEnvFile('.env.local')
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))
  throw new Error('Este comando só aceita Stripe em teste.')
const target = new URL(process.env.APP_URL || 'http://localhost:3000')
if (!['127.0.0.1', 'localhost'].includes(target.hostname))
  throw new Error('O destino deve ser local.')
let binary = process.env.STRIPE_CLI_PATH || `${homedir()}/.local/bin/stripe`
try {
  await access(binary)
} catch {
  binary = 'stripe'
}
const child = spawn(
  binary,
  [
    'listen',
    '--forward-to',
    `${target.origin}/api/stripe/webhook`,
    '--events',
    'checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,charge.refunded,charge.dispute.created,charge.dispute.updated,charge.dispute.closed',
  ],
  {
    env: { ...process.env, STRIPE_API_KEY: process.env.STRIPE_SECRET_KEY },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)
let configured = false
let buffer = ''
async function output(chunk) {
  const text = chunk.toString()
  buffer = (buffer + text).slice(-10000)
  const match = buffer.match(/whsec_[a-zA-Z0-9]+/)
  if (match && !configured) {
    configured = true
    let env = await readFile('.env.local', 'utf8')
    env = env.replace(/^STRIPE_WEBHOOK_SECRET=.*\n?/m, '')
    await writeFile(
      '.env.local',
      env + `\nSTRIPE_WEBHOOK_SECRET=${match[0]}\n`,
      { mode: 0o600 },
    )
    console.log(
      'Webhook de teste conectado. Segredo salvo em .env.local. Mantenha este terminal aberto.',
    )
  }
  if (configured && !text.includes('whsec_'))
    process.stdout.write(text.replace(/(?:sk|rk)_test_\w+/g, '[redacted]'))
}
child.stdout.on('data', (chunk) => {
  void output(chunk).catch(() =>
    console.error('Falha ao salvar configuração local.'),
  )
})
child.stderr.on('data', (chunk) => {
  void output(chunk).catch(() =>
    console.error('Falha ao salvar configuração local.'),
  )
})
child.on('error', () => {
  console.error('Instale a Stripe CLI oficial e tente novamente.')
  process.exitCode = 1
})
child.on('exit', (code) => {
  process.exitCode = code || 0
})
process.on('SIGINT', () => child.kill('SIGINT'))
process.on('SIGTERM', () => child.kill('SIGTERM'))
