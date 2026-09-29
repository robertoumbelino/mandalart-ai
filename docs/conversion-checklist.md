# Conversão — implementação local para revisão

Data: 28/09/2026. Branch `main`, sem commit e sem publicação. Preços e perguntas preservados. Migration `008_preview_continuity.sql` aplicada somente no Postgres local. Desenvolvimento em `http://localhost:3100` (a porta 3000 já estava ocupada).

## Checklist do briefing

| Item | Situação | Resultado / limite |
|---|---|---|
| 1. Pix | Investigado; ativação externa pendente | A conta inspecionada não apresentava Pix disponível. O nome da configuração não prova habilitação. Manter cartão até elegibilidade confirmada pela Stripe. Ver plano abaixo. |
| 2. Compra completa | Validada em sandbox | Compras reais do sandbox de R$37 e R$99, webhook, conta nova/existente, créditos, envio aceito pelo Resend, plano, retomada e link de acesso. Não houve cobrança real. |
| 3. Carregamento | Implementado e medido | Mensagens em sequência sem atraso mínimo. Cache preservado, manutenção via `after()`, métricas de IA/backend/request. Uma execução: 9.878 ms total, 9.826 ms IA, 52 ms restante. Não é benchmark nem promessa de latência. |
| 4. Checkout | Código e catálogo de teste prontos | Logo oficial, descrição consistente, garantia. Descrição do catálogo live ainda precisa ser atualizada quando a publicação for autorizada. |
| 5. CTA | Implementado | “Liberar meu Mandalart completo · R$37”; fixo “Liberar por R$37”. Entrada gratuita tem CTA próprio. |
| 6. Conquista na prévia | Implementado | Mensagem após três checks, CTA sem scroll automático; progresso gravado no banco e transferido à primeira tarefa paga. |
| 7. Mobile | Implementado | Títulos sem blur, contraste e fontes maiores; em até 480 px, caminhos em duas colunas e objetivo acima. Matriz mantida em telas maiores. |
| 8. E-mail | Implementado e observado no banco | `email_block_viewed` por visibilidade, `email_captured`, vínculo com prévia/sessão/lead/UTMs. Continua opcional e após a oferta. |
| 9. Método | Implementado | Estrutura 9×9, oito caminhos, referência discreta a Ohtani; sem foto ou alegação de uso do nosso produto. |
| 10. Diferenciação | Implementado | Objetivo → 8 caminhos → ações → execução; personalização como apoio. |
| 11. Exemplo | Implementado localmente | Mudar de carreira, oito caminhos selecionáveis, oito tarefas por caminho, três checks por tarefa e progresso interativo. Conteúdo gerado pelo próprio produto com dados fictícios de teste, sem afirmar que é um cliente real. |
| 12. Frase da prévia | Implementado | Texto pedido acima dos caminhos. |
| 13. Oferta | Implementado | Valor centrado em organização, próxima ação e progresso; 64 tarefas sai do destaque principal. |
| 14. FAQ IA | Implementado | Reconhece que é possível fazer um plano em um chat; explica a conveniência da estrutura, checklists e progresso existente. |
| 15. IA nos textos | Revisado | Principal ocorrência comercial estava na meta description global; substituída por personalização. Nome Mandalart, código técnico e menções explicativas preservados. |
| 16. Microexplicações | Implementado | Seis perguntas e escolhas intactas. Explicação curta do efeito de cada resposta, inclusive no mobile. Tabela abaixo. |
| 17. Feedback em 3 dias | Infraestrutura avaliada; envio não ativado | Resend já oferece agendamento e cancelamento. Preparação abaixo; nenhuma campanha ou automação de feedback foi enviada/criada. |

## Ajustes de continuidade e medição

- Home leva ao quiz com `iniciar=1`, preservando parâmetros e rascunho existente.
- E-mail, login e senha não são exigidos antes da prévia ou para abrir o checkout.
- O pedido guarda consentimento de marketing no próprio checkout. CAPI não depende mais da captura opcional de lead.
- `purchase_completed` no PostHog é emitido pelo servidor após conciliação. Usa o identificador anônimo do navegador, UUID do pedido e timestamp estável; o retorno usa `purchase_returned` para não contar outra compra.
- Recusa de analytics não é contornada: sem identificador autorizado do cliente, não enviamos a compra ao PostHog. Pedido e contabilidade continuam no banco.
- GA4 recebe `purchase` com transaction_id, currency BRL, value em reais e itens. Só em modo live e host de produção. Continua dependendo do retorno do navegador; não equivale a um relatório financeiro.
- Meta browser e CAPI usam `purchase-{orderId}`. CAPI permanece bloqueada em test mode. Eventos Meta live e recebimento nas plataformas exigem validação após publicação.
- Eventos de produto recebem `journey_version=conversion-v2`; PostHog só inicializa em builds de produção nos domínios oficiais (`mandalart.com.br`, `www.mandalart.com.br`, `mandalart-ai.vercel.app`). Localhost, IPs locais e URLs de preview não enviam eventos nem gravações. Compras no servidor também exigem `APP_URL` de produção e não são enviadas em deployments Vercel de preview. Eventos anteriores ao bloqueio continuam no histórico do PostHog.
- `plan_opened`, `task_completed` com ID do plano/caminho/tarefa, e `first_task_completed` permitem observar ativação. Os planos já iniciados na prévia podem chegar com a primeira tarefa concluída.
- Retorno mostra o objetivo comprado, diferencia pendente/expirado/falhou, explica geração posterior e acompanha a confirmação do e-mail.
- Usuário já autenticado na conta compradora pode continuar diretamente. Conta nova recebe confirmação da compra com link para concluir nome e senha; conta existente entra normalmente com suas credenciais. O retorno do checkout não cria sessão automaticamente.
- Link de compra tem conteúdo estável nas tentativas de envio e validade de 48 horas. Consumo do token e vínculo com a identidade do provedor são atômicos, preservando o usuário e plano comprados. Validação de origem usa o Host público para funcionar atrás de proxy.
- Compra confirmada limpa o rascunho correspondente do `/comecar`, inclusive em abas antigas. “Refazer do início” apaga respostas, prévia, e-mail e checks e volta à primeira pergunta. Cada recomeço tem um identificador próprio para não recuperar o progresso anterior pelo cache.

## Efeito das respostas

As respostas entram como contexto de geração, e não como regras determinísticas de quantidade ou prazo. A IA pode variar o conteúdo; não prometemos um calendário.

| Pergunta | Dado | Como influencia o resultado |
|---|---|---|
| 1. Escolha o que você quer realizar e descubra por onde começar. | Área | Seleciona sonhos sugeridos e contextualiza os caminhos. |
| 2. O que você gostaria de realizar? | Objetivo | Define o assunto da prévia, dos oito caminhos e de todas as ações. Texto livre passa pela triagem existente. |
| 3. Como está esse sonho hoje? | Estágio | Orienta o ponto de partida e considera o que já foi iniciado/pesquisado. |
| 4. O que torna o próximo passo mais difícil? | Obstáculo | Orienta prioridades e a justificativa da primeira ação. |
| 5. Quanto tempo cabe na sua semana? | Disponibilidade | Orienta tamanho/esforço das ações; primeira tarefa limitada entre 5 e 30 minutos. |
| 6. Quando você quer ver os primeiros avanços? | Horizonte | Orienta avanços iniciais, sem prometer concluir o sonho naquele prazo. |

Todas chegam à prévia e ao contexto do Mandalart completo. A geração completa preserva os títulos/descrições dos oito caminhos e o conteúdo exato do primeiro passo. Nenhuma pergunta é decorativa.

## Exemplo e evidência de produto

O componente `ProductDemo.tsx` contém o objetivo **mudar de carreira**, os oito caminhos, descrições e o plano completo de 64 tarefas/192 checks em `lib/example-mandalart.json`: definir a profissão-alvo, mapear as atividades do trabalho, levantar competências necessárias, reconhecer habilidades transferíveis, planejar o aprendizado, conhecer a realidade da área, preparar a transição e consolidar a mudança.

É uma demonstração interativa, não um relato de cliente. Não foram publicados depoimentos, identidades ou fotos fictícias apresentados como reais. A interface paga já possui checklists, percentual, próximo passo e evolução visual da Mandala; a visão de execução agora abre primeiro, mantendo o acesso à matriz e exportação.

## Testes e limites

Atualização do cadastro e reinício: `pnpm check` passou com 172 testes, lint e TypeScript. Teste de integração com o serviço real de autenticação confirmou criação de senha, saída, novo login, manutenção do mesmo usuário/plano e invalidação do token usado. No navegador, “Refazer do início” voltou à pergunta 1 sem seleção e permaneceu assim após recarregar. Os registros de compra e link de acesso abaixo são da validação anterior à substituição do acesso automático pelo cadastro com senha.

Validação final: `pnpm check` passou (lint, TypeScript e 129 testes em 23 arquivos), `pnpm test:credits` passou nos 18 cenários de banco e `pnpm build` concluiu. `git diff --check` sem erros. A home foi conferida em desktop e 390 px, incluindo marcação de ações, troca de caminho e seleção de outra tarefa na demonstração, sem erros de console nessa navegação.

Resultados detalhados dos testes locais: `contents/conversion-qa/results.json` (ignorado pelo Git). Script reprodutível: `scripts/verify-conversion-local.mjs`, após as compras de sandbox do destinatário de simulação indicado no script. O link de acesso é de uso único: executar novamente exige um novo pedido ou testar explicitamente o resultado 410.

- R$37: conta nova, um crédito, um plano gerado, primeiro passo preservado (3/3).
- R$99: mesma conta, três créditos; após a primeira geração anterior, saldo três antes/depois de repetir os webhooks.
- Seis reenvios concorrentes de webhooks: HTTP 200, sem duplicação de saldo nem de eventos de compra no banco.
- Envio opcional da prévia e envio de acesso aceitos pelo Resend nos endereços de simulação oficiais. Não significa entrega em Gmail/Outlook. A chave local só permite envio; consulta da API de e-mails retornou 401.
- Link que corresponde ao enviado pelo sistema: GET não consome, POST cria sessão e retorna ao objetivo, replay recebe 410.
- Cancelamento do checkout preservou prévia, três checks e e-mail salvo.
- Eventos de visualização da oferta/e-mail, captura e compra encontrados no banco da sessão.
- Conta existente em retorno anônimo: confirmação exigida e nenhum cookie de acesso concedido antes da verificação.
- Testes de consentimento da compra direta, validação de origem/proxy, progresso parcial/completo, valores, Pix pendente sem crédito e rejeição de eventos de ambiente errado.
- Responsividade conferida em 360, 390 e 430 px, com oito caminhos presentes e sem overflow horizontal. Capturas em `contents/conversion-qa/`.
- Viewports no navegador são testes responsivos; não equivalem a ensaio em aparelhos físicos ou Safari/iOS.
- GA4, Meta CAPI/Pixel e PostHog live não receberam compras fictícias como vendas de produção. Confirmar recebimento/deduplicação nos painéis em publicação controlada.

## Configuração de funis pronta para aplicar

Não alterar os dashboards antigos antes da publicação desta versão. Criar/atualizar a visualização com:

1. Principal: `quiz_started → quiz_completed → preview_viewed → checkout_started → purchase_completed → plan_opened`. E-mail fica fora dos passos obrigatórios.
2. Diagnóstico da oferta: `preview_viewed → offer_viewed → unlock_clicked → checkout_started`.
3. E-mail: `preview_viewed → email_block_viewed → email_captured`, segmentando depois compras com/sem lead. Isso não mede causalidade do e-mail.
4. Quebrar por dispositivo, origem/UTM, campanha, conjunto e anúncio; filtrar `site_environment=production` e `journey_version=conversion-v2`. Usar a mesma janela e denominador.
5. Receita e compradores: pedidos conciliados `status='paid'`, `mode='live'`, por order_id; reconciliar reembolsos separadamente. Retorno ao site não é a fonte financeira.

Os eventos antigos `begin_started`, `begin_offer_interest` e `purchase_confirmed` não devem compor um funil misturado com estes. Os dados vistos na avaliação têm janela/amostra diferentes, e os funis antigos não demonstram ausência de vendas.

## Pix: decisão técnica

**Pix suportado na conta atual: não disponível na configuração inspecionada.** A Stripe documenta elegibilidade por convite no Brasil: https://support.stripe.com/questions/how-to-enable-pix-as-a-payment-method-in-brazil?locale=pt-BR

Rascunho para suporte (não enviado): “Gostaria de verificar a elegibilidade da nossa conta brasileira para Pix no Stripe Checkout em BRL, em compras avulsas. O método não aparece nas configurações de pagamento. Podem informar os requisitos e a possibilidade de habilitação?”

Quando elegível: habilitar na configuração correta, testar geração de QR, pagamento pendente, confirmação assíncrona, falha e expiração, reembolso, order bump e valor. O reconciliador já reconhece eventos async e só concede créditos quando Session e PaymentIntent confirmam o recebimento. Não basta trocar `STRIPE_PIX_ENABLED` nem renomear a configuração.

## Feedback em três dias

Infraestrutura existente: Resend, envio transacional, idempotency keys, agendamento de recuperação em 1h/24h e cancelamento. É possível agendar após pagamento confirmado, guardar ID/estado no pedido e cancelar se houver reembolso/descadastro. Seriam necessários campos de controle e uma rotina de reenvio/observação de falhas. Não usar o consentimento para anúncios como autorização implícita para mensagens de marketing.

Conteúdo preparado: “Você já tinha tentado organizar esse objetivo de outra forma?”; “O que mudou depois de usar o Mandalart?”; “Qual parte mais te ajudou a sair do planejamento para a ação?”. Falta decidir o destino da resposta (caixa monitorada ou formulário existente). Não foi criada uma nova tela nem automação.

## Antes de publicar, depois do teste do usuário

Para revisar localmente: `http://localhost:3100` e `http://localhost:3100/comecar`. Caso precise reiniciar o servidor, usar `APP_URL=http://localhost:3100 pnpm dev --port 3100` e manter o encaminhamento da Stripe para essa mesma porta. As credenciais locais são de teste; a migration 008 já foi aplicada nesse banco. Capturas da home e prévia estão em `contents/conversion-qa/`.

Aplicar migration 008 no banco de produção, publicar código, atualizar a descrição do produto live sem trocar preços, aplicar os funis e verificar compra/entrega real com o titular. Pix permanece dependência externa. Nenhuma dessas mudanças de produção foi executada.

Referências: [Resend: endereços simulados e labels](https://resend.com/docs/dashboard/emails/send-test-emails), [PostHog: captura de eventos](https://posthog.com/docs/api/capture), [quadro de Ohtani: reportagem disponibilizada pelo instituto Harada](https://harada-educate.jp/admin/wp-content/uploads/2018/09/WSJ-9-11-18.pdf).
