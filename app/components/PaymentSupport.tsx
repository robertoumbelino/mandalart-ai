import { SUPPORT_EMAIL, getSupportHref } from '@/lib/support'

const supportLink = getSupportHref('Ajuda com pagamento no Mandalart')

export function PaymentSupport() {
  return <aside aria-label="Ajuda com pagamento" style={{ marginTop: 18, padding: '16px 18px', border: '1px solid #ded9ed', borderRadius: 14, background: '#f8f6ff', color: '#44465a', fontSize: 14, lineHeight: 1.55 }}>
    <strong>Precisa de ajuda com seu pagamento?</strong>
    <p style={{ margin: '6px 0 0' }}>Se o valor já saiu da sua conta, não pague novamente agora. Escreva para <a href={supportLink} style={{ color: '#5031a9', fontWeight: 700, overflowWrap: 'anywhere' }}>{SUPPORT_EMAIL}</a> e informe o e-mail usado na compra, o valor e o horário aproximado. Vamos verificar.</p>
  </aside>
}
