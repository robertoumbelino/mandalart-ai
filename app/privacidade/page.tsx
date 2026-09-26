import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Mandalart.AI',
  description: 'Como o Mandalart.AI coleta, utiliza e protege seus dados.'
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-700">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-100 bg-white p-8 shadow-sm sm:p-12">
        <Link href="/" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
          ← Voltar ao Mandalart.AI
        </Link>

        <h1 className="mt-8 text-3xl font-black tracking-tight text-slate-900">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-slate-500">Última atualização: 26 de setembro de 2026</p>

        <div className="mt-8 space-y-7 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-slate-900">1. Dados que tratamos</h2>
            <p className="mt-2">
              Para criar e acessar sua conta, tratamos nome, endereço de e-mail, foto de perfil opcional e credenciais de autenticação. Quando você usa o produto, armazenamos os objetivos, respostas, planos Mandalart e progresso que decidir salvar.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">2. Login com Google</h2>
            <p className="mt-2">
              Ao escolher o Google, recebemos somente as informações básicas autorizadas para autenticação: identificador da conta Google, nome, e-mail verificado e foto de perfil. Não recebemos sua senha do Google nem acessamos Gmail, Drive, contatos ou agenda.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">3. Como usamos os dados</h2>
            <p className="mt-2">
              Usamos os dados para autenticar sua conta, manter seus planos salvos, gerar perguntas e sugestões com inteligência artificial, proteger o serviço contra abuso e corrigir falhas. Objetivos e respostas necessários à geração são processados pelos provedores de infraestrutura e IA usados pelo Mandalart.AI.
            </p>
            <p className="mt-2">
              Na prévia sem cadastro, em /comecar, guardamos as respostas e o progresso neste navegador por até 7 dias desde o último uso. Ao solicitar a geração, as respostas também são processadas pela IA e a prévia fica associada a uma sessão anônima em nosso servidor. Usamos um cookie protegido para recuperar a mesma prévia, referências da campanha para identificar sua origem e um identificador de rede protegido por hash para limitar abusos. Os eventos de uso da jornada não contêm o texto do seu sonho nem suas respostas.
            </p>
            <p className="mt-2">
              Usamos Vercel Analytics e Google Analytics para entender visitas, páginas acessadas e etapas de uso do site. As URLs enviadas ao Google não incluem parâmetros de consulta, e os eventos de uso não incluem o texto dos seus sonhos ou respostas. O Google pode tratar identificadores do navegador e dados técnicos conforme sua própria política de privacidade. A medição do Google Analytics ocorre apenas em mandalart.com.br.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">4. Compartilhamento e armazenamento</h2>
            <p className="mt-2">
              Não vendemos seus dados. Eles são compartilhados apenas com fornecedores essenciais de hospedagem, banco de dados, autenticação, processamento de IA e pagamentos, na medida necessária para operar o serviço e sujeitos às práticas de segurança desses fornecedores.
            </p>
            <p className="mt-2">
              O Neon gerencia o login por Google ou e-mail e senha, as sessões e a recuperação de senha. Seus planos e créditos continuam associados à mesma conta do Mandalart.AI.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">Pagamentos e créditos</h2>
            <p className="mt-2">
              O checkout é processado pelo Stripe. Compartilhamos seu e-mail, o identificador da conta e os dados do pedido necessários para confirmar a compra. Os dados do cartão são informados diretamente ao Stripe; o Mandalart.AI não recebe nem armazena o número completo do cartão ou o código de segurança. Guardamos identificadores e situação do pagamento, valores, saldo e movimentações de sonhos para entregar o serviço e conciliar compras, reembolsos e contestações.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">5. Segurança e retenção</h2>
            <p className="mt-2">
              Adotamos controles como cookies de sessão protegidos, senhas com hash e validação de identidade no servidor. Mantemos os dados enquanto sua conta estiver ativa ou pelo período necessário para segurança e cumprimento de obrigações legais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">6. Seus direitos e contato</h2>
            <p className="mt-2">
              Você pode solicitar acesso, correção ou exclusão dos seus dados pelo e-mail de suporte informado na tela de consentimento do Google. Também pode deixar de usar o login Google removendo o acesso ao Mandalart.AI nas configurações da sua Conta Google.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
