import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Uso | Mandalart.AI',
  description: 'Termos aplicáveis ao uso do Mandalart.AI.'
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-700">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-100 bg-white p-8 shadow-sm sm:p-12">
        <Link href="/" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
          ← Voltar ao Mandalart.AI
        </Link>

        <h1 className="mt-8 text-3xl font-black tracking-tight text-slate-900">Termos de Uso</h1>
        <p className="mt-2 text-sm text-slate-500">Última atualização: 13 de setembro de 2026</p>

        <div className="mt-8 space-y-7 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-slate-900">1. Aceitação</h2>
            <p className="mt-2">
              Ao criar uma conta ou usar o Mandalart.AI, você concorda com estes Termos e com a nossa Política de Privacidade. Se não concordar, não utilize o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">2. Finalidade do serviço</h2>
            <p className="mt-2">
              O Mandalart.AI auxilia na organização de objetivos e planos de ação. As sugestões geradas por inteligência artificial podem conter imprecisões e devem ser avaliadas por você antes de qualquer decisão ou execução.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">3. Sua conta</h2>
            <p className="mt-2">
              Você é responsável por manter suas credenciais seguras e pelas atividades realizadas na conta. Não tente acessar contas de terceiros, contornar controles de segurança ou usar o serviço de forma ilegal ou abusiva.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">4. Seu conteúdo</h2>
            <p className="mt-2">
              Você mantém os direitos sobre os objetivos e informações que inserir. Concede ao Mandalart.AI somente a autorização necessária para armazenar e processar esse conteúdo a fim de fornecer as funcionalidades solicitadas.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">5. Disponibilidade e responsabilidade</h2>
            <p className="mt-2">
              Podemos modificar, suspender ou descontinuar funcionalidades. O serviço é fornecido conforme disponível e não substitui aconselhamento profissional financeiro, jurídico, médico ou de outra natureza especializada.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">6. Alterações</h2>
            <p className="mt-2">
              Estes Termos podem ser atualizados para refletir mudanças no produto ou na legislação. A data no início da página indica a versão vigente.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
