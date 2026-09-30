import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { BrandLogo } from '@/app/components/Brand'
import { getCurrentUser } from '@/actions/auth'
import { getDreamWallet } from '@/actions/dreams'
import { getPurchaseHistory } from '@/actions/refunds'
import { PurchaseHistory } from './PurchaseHistory'
import './compras.css'

export const metadata: Metadata = {
  title: 'Minhas compras | Mandalart',
  robots: { index: false, follow: false },
}

export default async function PurchasesPage() {
  await connection()
  const user = await getCurrentUser()
  const purchases = user ? await getPurchaseHistory() : null
  const wallet = user ? await getDreamWallet() : null

  return <main className="purchase-page">
    <header className="purchase-header">
      <div className="purchase-header-inner">
        <Link href="/" aria-label="Mandalart, início" className="purchase-brand"><BrandLogo iconSize={29} /></Link>
        {user && <div className="purchase-header-actions">
          <Link href="/sonhos" className="purchase-wallet"><Sparkles size={17} aria-hidden="true" />{wallet?.balance ?? 0} {wallet?.balance === 1 ? 'sonho disponível' : 'sonhos disponíveis'}<ArrowRight size={16} aria-hidden="true" /></Link>
          <span className="purchase-avatar" aria-label={`Conta de ${user.name}`}>{(user.name?.trim().charAt(0) || user.email.charAt(0)).toUpperCase()}</span>
        </div>}
      </div>
    </header>

    <div className="purchase-content">
      <nav className="purchase-breadcrumb" aria-label="Navegação"><Link href="/">Início</Link><span aria-hidden="true">/</span><span>Minha conta</span></nav>
      <h1>Minhas compras</h1>
      <p className="purchase-subtitle">Acompanhe seus pagamentos e reembolsos em um só lugar.</p>

      {purchases === null ? <section className="purchase-empty">
        <h2>Entre para ver suas compras</h2>
        <p>Use a conta vinculada ao e-mail da compra para acompanhar os pagamentos e solicitar reembolso.</p>
        <Link href="/sonhos">Entrar na minha conta <ArrowRight size={17} /></Link>
      </section> : purchases.length === 0 ? <section className="purchase-empty">
        <h2>Nenhuma compra confirmada nesta conta</h2>
        <p>Quando um pagamento for confirmado, ele aparecerá aqui.</p>
        <Link href="/sonhos">Conhecer os Mandalarts <ArrowRight size={17} /></Link>
      </section> : <PurchaseHistory purchases={purchases} />}

      <Link href="/" className="purchase-back"><ArrowLeft size={17} aria-hidden="true" /> Voltar ao Mandalart</Link>
    </div>
  </main>
}
