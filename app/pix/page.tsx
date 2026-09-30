import type { Metadata } from 'next'
import { PixPayment } from './PixPayment'
import './pix.css'

export const metadata: Metadata = { title: 'Pagar com Pix | Mandalart', robots: { index: false, follow: false } }
export default function PixPage() { return <PixPayment /> }
