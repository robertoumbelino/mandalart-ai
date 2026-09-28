import { NextResponse } from 'next/server'
import { verifyLeadLink } from '@/lib/lead-link'
import { getDb } from '@/lib/db'
import { setPreviewSession } from '@/lib/onboarding-server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token') || ''
    if (token.length > 1000) throw new Error('Link inválido.')
    const id = verifyLeadLink(token)
    const [lead] = await getDb()`SELECT session_id FROM onboarding_leads WHERE id=${id}::uuid AND preview_id IS NOT NULL`
    if (!lead) throw new Error('Prévia indisponível.')
    await setPreviewSession(String(lead.session_id))
    return NextResponse.redirect(new URL('/comecar?retomar=1', request.url))
  } catch {
    return NextResponse.redirect(new URL('/comecar?link=expirado', request.url))
  }
}
