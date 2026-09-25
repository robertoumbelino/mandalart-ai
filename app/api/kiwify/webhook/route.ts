import { processKiwifyEvent, verifyKiwifySignature } from '@/lib/kiwify'

export async function POST(request: Request) {
  const body = await request.text()
  if (body.length > 100_000) return new Response('Payload too large', { status: 413 })
  const signature = new URL(request.url).searchParams.get('signature')
  if (!verifyKiwifySignature(body, signature))
    return new Response('Invalid signature', { status: 400 })

  try {
    await processKiwifyEvent(JSON.parse(body))
    return new Response('ok')
  } catch (error) {
    console.error('kiwify_webhook_processing_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    })
    return new Response('Processing failed', { status: 500 })
  }
}
