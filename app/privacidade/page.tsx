import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingPreferenceButton } from './MarketingPreferenceButton'
import { AnalyticsPrivacyButton } from './AnalyticsPrivacyButton'

export const metadata: Metadata = {
  title: 'Política de Privacidade | Mandalart',
  description: 'Como o Mandalart coleta, utiliza e protege seus dados.'
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-700">
      <article className="mx-auto max-w-3xl rounded-3xl border border-slate-100 bg-white p-8 shadow-sm sm:p-12">
        <Link href="/" className="text-sm font-bold text-indigo-600 hover:text-indigo-700">
          ← Voltar ao Mandalart
        </Link>

        <h1 className="mt-8 text-3xl font-black tracking-tight text-slate-900">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-slate-500">Última atualização: 28 de setembro de 2026</p>

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
              Usamos os dados para autenticar sua conta, manter seus planos salvos, gerar perguntas e sugestões com inteligência artificial, proteger o serviço contra abuso e corrigir falhas. Objetivos e respostas necessários à geração são processados pelos provedores de infraestrutura e IA usados pelo Mandalart.
            </p>
            <p className="mt-2">
              Na prévia sem cadastro, em /comecar, guardamos as respostas e o progresso neste navegador por até 7 dias desde o último uso. Ao solicitar a geração, as respostas também são processadas pela IA e a prévia fica associada a uma sessão anônima em nosso servidor. Usamos um cookie protegido para recuperar a mesma prévia, referências da campanha para identificar sua origem e um identificador de rede protegido por hash para limitar abusos. Os eventos de uso da jornada não contêm o texto do seu sonho nem suas respostas.
            </p>
            <p className="mt-2">
              Quando você informa seu e-mail para receber a prévia, guardamos o endereço, as respostas e a origem da visita para retomar seu caminho. Enviamos a prévia e, se você a visualizar sem comprar, podemos enviar até dois lembretes em 1 e 24 horas. Cancelamos os lembretes quando a compra é confirmada ou você pede o descadastro. O Resend processa esses envios. O pagamento pode ser feito sem criar senha; após a confirmação, enviamos um link de acesso de uso único ao e-mail do checkout. Você também pode solicitar outro link em /acessar. Cada link expira em 48 horas, e a sessão criada neste aparelho dura até 30 dias.
            </p>
            <p className="mt-2">
              Usamos Vercel Analytics e Google Analytics para entender visitas, páginas acessadas e etapas de uso do site. As URLs enviadas ao Google não incluem parâmetros de consulta, e os eventos de uso não incluem o texto dos seus sonhos ou respostas. O Google pode tratar identificadores do navegador e dados técnicos conforme sua própria política de privacidade. A medição do Google Analytics ocorre apenas em mandalart.com.br.
            </p>
            <p className="mt-2">
              Se você aceitar os cookies opcionais, usamos o Pixel da Meta para medir visitas, prévias gratuitas concluídas, criação de contas, início de pagamento e compras confirmadas, ajudando a avaliar nossos anúncios. Em compras, também podemos enviar o evento pelo servidor com o valor, a moeda e um hash do e-mail para deduplicação. Não enviamos o texto do seu objetivo, suas respostas nem os detalhes do plano. O Pixel só é carregado depois da sua escolha. Você pode mudar essa escolha a qualquer momento.
            </p>
            <MarketingPreferenceButton />
            <p className="mt-2">
              Usamos o PostHog desde a visita para medir páginas e etapas da jornada, como início, prévia, cadastro e compra, e para assistir a gravações da navegação. Essa análise funciona independentemente da escolha sobre cookies opcionais para anúncios. O PostHog recebe identificadores do navegador e dados técnicos da visita; depois do login, associamos eventos ao identificador interno da conta para acompanhar a jornada entre visitas. Não incluímos o texto dos objetivos, respostas, e-mail ou dados do cartão nos eventos de análise. Nas gravações, objetivos, respostas, planos, progresso e outros textos exibidos ou digitados ficam visíveis; ocultamos o nome e o e-mail exibidos na conta, além dos campos de e-mail e senha. Textos livres podem conter dados pessoais informados por você. Também desativamos o envio de conteúdo de rede e retiramos parâmetros das URLs. Você pode desativar essa análise neste navegador a qualquer momento.
            </p>
            <AnalyticsPrivacyButton />
            <p className="mt-2">
              Se você chega por uma campanha, guardamos os parâmetros de origem presentes no link por até 30 dias neste navegador. Ao iniciar uma compra, associamos esses parâmetros ao pedido para saber qual anúncio gerou a venda, mesmo quando o pagamento acontece no site do provedor.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">4. Compartilhamento e armazenamento</h2>
            <p className="mt-2">
              Não vendemos seus dados. Compartilhamos as informações necessárias com fornecedores de hospedagem, banco de dados, autenticação, processamento de IA, pagamentos e envio de e-mails para operar o serviço. O PostHog recebe os dados de análise descritos acima durante a visita. A Meta recebe eventos de anúncios apenas se você aceitar os cookies opcionais.
            </p>
            <p className="mt-2">
              O Neon gerencia o login por Google ou e-mail e senha, as sessões e a recuperação de senha. Seus planos e créditos continuam associados à mesma conta do Mandalart.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">Pagamentos e créditos</h2>
            <p className="mt-2">
              O checkout é processado pelo provedor de pagamento escolhido, como Stripe, Asaas ou Kiwify. Compartilhamos seu e-mail e os dados do pedido necessários para confirmar a compra. Uma conta é criada ou vinculada após o pagamento; se o e-mail já pertence a uma conta, o acesso exige confirmação pelo link enviado a esse endereço. Os dados do cartão são informados diretamente ao provedor; o Mandalart não recebe nem armazena o número completo do cartão ou o código de segurança. Guardamos identificadores e situação do pagamento, valores, saldo e movimentações de sonhos para entregar o serviço e conciliar compras, reembolsos e contestações.
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
              Você pode solicitar acesso, correção ou exclusão dos seus dados pelo e-mail de suporte informado na tela de consentimento do Google. Também pode deixar de usar o login Google removendo o acesso ao Mandalart nas configurações da sua Conta Google.
            </p>
          </section>
        </div>
      </article>
    </main>
  )
}
