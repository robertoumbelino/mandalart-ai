import { NextResponse } from 'next/server'
import { previewRequestSchema } from '@/lib/onboarding'
import { preparePreview } from '@/lib/onboarding-server'

export const runtime = 'nodejs'
export const maxDuration = 90

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  // Next can normalize request.url to localhost behind a proxy. Compare the
  // browser's origin with the actual request Host, not the internal server URL.
  let sameOrigin = false
  try {
    const source = new URL(origin || '')
    sameOrigin =
      source.host === request.headers.get('host') &&
      source.origin === origin &&
      ['http:', 'https:'].includes(source.protocol)
  } catch {
    /* Missing or malformed origins are rejected. */
  }
  if (!sameOrigin) {
    return NextResponse.json(
      { status: 'error', message: 'Atualize a página para continuar.' },
      { status: 403 }
    )
  }
  if (Number(request.headers.get('content-length') || 0) > 10_000) {
    return NextResponse.json(
      { status: 'error', message: 'Sua resposta ficou muito longa.' },
      { status: 413 }
    )
  }
  try {
    const body = await request.text()
    if (body.length > 10_000) return new NextResponse(null, { status: 413 })
    const parsed = previewRequestSchema.safeParse(JSON.parse(body))
    if (!parsed.success)
      return NextResponse.json(
        {
          status: 'error',
          message: 'Confira suas respostas antes de continuar.'
        },
        { status: 400 }
      )
    const result = await preparePreview(
      parsed.data.answers,
      parsed.data.attribution
    )
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, no-store' }
    })
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        message:
          'Não foi possível conectar agora. Suas respostas continuam aqui para tentar novamente.'
      },
      { status: 503 }
    )
  }
}
