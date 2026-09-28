import type { Metadata } from 'next'
import { PurchaseReturn } from './PurchaseReturn'

export const metadata: Metadata = { title: 'Sua compra | Mandalart.AI', robots: { index: false, follow: false } }
export default function PurchasePage() { return <PurchaseReturn /> }
