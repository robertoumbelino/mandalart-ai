import type { Metadata } from 'next'
import { DreamShop } from './DreamShop'
import './sonhos.css'
export const metadata: Metadata = {
  title: 'Seus sonhos | Mandalart.AI',
  robots: { index: false, follow: false },
}
export default function DreamsPage() {
  return <DreamShop />
}
