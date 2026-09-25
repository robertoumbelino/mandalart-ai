# Jornada pública em /comecar

## Experiência

A página contém apresentação, seis perguntas com alternativas, entrada livre opcional, geração real de uma prévia com IA, primeira tarefa com três ações marcáveis, oito pilares expansíveis e oferta de 1 ou 3 sonhos. O CTA leva a `/sonhos`: visitantes entram na conta e passam pelo ponto de checkout exclusivo do `/comecar`; quem já estava logado segue pelo checkout Stripe da conta. Por enquanto ambos usam Stripe. Pacotes: 1 sonho por R$ 39,90 ou 3 por R$ 99,90. A prévia gratuita permanece no navegador. Veja [payments.md](./payments.md).

O roteiro cobre área, sonho, ponto de partida, dificuldade, disponibilidade e horizonte dos primeiros avanços. Selecionar outra área remove o sonho anterior. Editar respostas invalida a prévia e o checklist. Voltar sem mudar as respostas preserva ambos.

A tipografia Poppins é compartilhada com o restante da aplicação e servida localmente, com licença OFL em `app/fonts`. A ilustração é vetorial, sem dependência de imagens remotas. Os estilos são limitados ao layout da rota. Há navegação por teclado, foco nos títulos, inputs nativos, modal nativo, estados selecionados que não dependem só de cor, layout de 320px em diante e respeito a movimento reduzido.

## Estado e retomada

- Rascunho versionado em `localStorage`, validado por Zod, com validade de 7 dias desde o último uso. Armazenamento indisponível não bloqueia o fluxo: um aviso explica a limitação.
- Etapas em `history.state`, mantendo o pathname `/comecar`; perguntas e prévia não aparecem na URL. Os botões voltar/avançar do navegador navegam entre etapas.
- Interrupção da geração retorna às respostas, sem disparar outra chamada automaticamente.
- A primeira tarefa e o pacote escolhido permanecem no navegador. Ainda não há sincronização de checklist entre aparelhos.
- `afid`, `ref`, UTMs, `src` e `sck` são preservados como origem inicial do rascunho e persistidos com a prévia. Isso não constitui atribuição ou comissão Kiwify; o checkout futuro precisa validar o vínculo oficial do afiliado.

## Geração e proteção de custo

`POST /api/onboarding/preview` valida origem, tamanho e respostas antes de chamar IA. Escolhas do catálogo são curadas; texto livre usa a mesma classificação de segurança do aplicativo autenticado. A resposta da IA é validada: oito pilares, uma tarefa, três ações. Não existe plano completo escondido no navegador.

Uma sessão anônima em cookie HttpOnly assinado limita o acesso ao cache próprio. A combinação de sessão e respostas identifica a prévia no Postgres. A reserva atômica impede gerações concorrentes da mesma prévia; reservas interrompidas podem ser retomadas após dois minutos. Repetir uma prévia pronta retorna o resultado persistido.

Limites persistentes: 8 solicitações novas por sessão/hora, 20 por origem de rede/hora e 1.000/dia no total. O IP é transformado por HMAC, sem armazenamento em texto puro. O limite global só é debitado depois dos limites individuais. Um proxy de produção precisa fornecer IPs confiáveis; proteger essa rota também no provedor ao abrir campanhas públicas.

As prévias expiram para reutilização em 7 dias. A limpeza física de prévias e limites vencidos é oportunista após uma geração bem-sucedida; ao lançar, adicionar manutenção programada para também limpar em períodos sem tráfego. Prompts e respostas não são enviados aos eventos de analytics nem aos logs de erros.

Eventos de funil: `begin_view`, `begin_started`, `begin_question_completed`, `begin_preview_requested`, `begin_preview_ready`, `begin_preview_error`, `begin_first_step_interaction`, `begin_pack_selected`, `begin_offer_interest`. Não registrar sonhos, respostas ou texto livre nesses eventos. Os eventos não são confirmação de compra e não implementam rastreamento de pagamentos.

## Integrações futuras

A integração Stripe já confirma pagamento no servidor, credita a conta e permite gerar o planner com as respostas da prévia. A jornada de perguntas e prévia continua em `/comecar`; compra e saldo ficam em `/sonhos`. O retorno do Stripe não libera créditos por query string: consulta o pedido autenticado e verifica a confirmação no provedor. O usuário escolhe quando gerar o planner, consumindo um sonho.

O checkout do `/comecar` foi isolado em `actions/onboarding-checkout.ts`. A alternativa Kiwify está implementada, mas desligada por `KIWIFY_ONBOARDING_ENABLED=false` até validar o produto compartilhado, seus links de afiliado e um pagamento real. A confirmação assinada de pagamento e a conciliação de reembolso/contestação estão em `lib/kiwify.ts`; os créditos continuam dependentes do webhook. Veja [payments.md](./payments.md). Ao gerar a partir da prévia, o servidor valida sua sessão e recupera os oito pilares e o primeiro passo originais. Eles são preservados no planner completo. A marcação do checklist gratuito não é transferida; o acompanhamento do planner começa do zero.

Jev foi avaliado como classificador opcional de sonhos livres. Não foi integrado: não há credencial TypeSafe configurada, e as alternativas atuais são tratadas por regras determinísticas. O gerador existente no AI Gateway produz a prévia. Não adicionar latência de uma chamada por pergunta; comparar Jev em português antes de ativar uma ramificação experimental.

## Banco local

O projeto reutiliza o Postgres do container `adstart-database`, acessível em `127.0.0.1:5432`. O banco `mandalart_local` e o usuário `mandalart` são próprios do Mandalart; as bases da Adstart permanecem separadas. Não há container ou volume de Postgres dedicado ao Mandalart. Aplicar as migrations pendentes localmente como descrito no README. `lib/db.ts` usa `pg` em loopback e mantém Neon para o deploy. O servidor de desenvolvimento recusa banco remoto. Não copiar dados de clientes de produção para os testes.

## Validação

`pnpm check` valida tipos, lint e testes de schema, retomada, origem, geração, segurança, cache e limites. `pnpm build` valida o build de produção. Testar no navegador apresentação, fluxo completo, erro recuperável, campo livre, alteração de categoria, voltar/avançar, reload, checklist, pilares, pacotes e modal. Antes de lançar com checkout, testar também o navegador interno do Instagram em aparelhos reais e a atribuição de uma compra de afiliado.
