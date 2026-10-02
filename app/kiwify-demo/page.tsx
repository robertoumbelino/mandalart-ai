import { notFound } from 'next/navigation'
import { kiwifyLocalDemoEnabled } from '@/lib/kiwify'
import KiwifyDemoClient from './KiwifyDemoClient'

export default function KiwifyDemoPage() {
  if (!kiwifyLocalDemoEnabled()) notFound()
  return <KiwifyDemoClient />
}
