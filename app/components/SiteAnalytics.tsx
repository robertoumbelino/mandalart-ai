'use client'

import { usePathname } from 'next/navigation'
import { Analytics } from '@vercel/analytics/next'
import { GoogleAnalytics } from './GoogleAnalytics'
import { MetaPixel } from './MetaPixel'
import { PostHogAnalytics } from './PostHogAnalytics'

export function SiteAnalytics() {
  const pathname = usePathname()
  // Email proofs and password forms must not load third-party tracking scripts.
  if (pathname === '/finalizar-cadastro' || pathname === '/redefinir-senha') return null
  return <><Analytics /><GoogleAnalytics /><MetaPixel /><PostHogAnalytics /></>
}
