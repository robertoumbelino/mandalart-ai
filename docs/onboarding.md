# Jornada pública em /comecar

## Experiência

A página contém apresentação, seis perguntas com alternativas, entrada livre opcional, geração real de uma prévia com IA, primeira tarefa com três ações marcáveis, oito pilares expansíveis e oferta de 1 ou 3 sonhos. O CTA abre um aviso de lançamento futuro. Não há checkout, cobrança, compra simulada, preço inventado, criação de créditos ou geração do planner pago.

O roteiro cobre área, sonho, ponto de partida, dificuldade, disponibilidade e horizonte dos primeiros avanços. Selecionar outra área remove o sonho anterior. Editar respostas invalida a prévia e o checklist. Voltar sem mudar as respostas preserva ambos.

As fontes DM Sans e Lora são servidas localmente, com licenças OFL em `app/comecar/fonts`. A ilustração é vetorial, sem dependência de imagens remotas. Os estilos são limitados ao layout da rota. Há navegação por teclado, foco nos títulos, inputs nativos, modal nativo, estados selecionados que não dependem só de cor, layout de 320px em diante e respeito a movimento reduzido.

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

1. Definir preços, validade dos créditos, duração do acesso e política de refazer um planner.
2. Integrar checkout preservando a atribuição oficial do afiliado. Associar a compra à prévia por identificador seguro, sem confiar no estado do navegador.
3. Confirmar pagamento no servidor por webhook autenticado e idempotente. O retorno público deve usar a própria `/comecar`, sem liberar conteúdo baseado em query string.
4. Verificar a posse da conta de destino e expandir a prévia persistida, mantendo pilares e primeira tarefa. Liberar os créditos uma única vez; geração malsucedida não deve cobrar de novo.
5. Revisar permissões de geração do aplicativo autenticado para o modelo comercial.

Jev foi avaliado como classificador opcional de sonhos livres. Não foi integrado: não há credencial TypeSafe configurada, e as alternativas atuais são tratadas por regras determinísticas. O gerador existente no AI Gateway produz a prévia. Não adicionar latência de uma chamada por pergunta; comparar Jev em português antes de ativar uma ramificação experimental.

## Banco local

`docker compose up -d` inicia somente o Postgres deste projeto, publicado no loopback em `55432`. Banco: `mandalart_local`; volume: `mandalart-postgres-data`. Aplicar as três migrations localmente como descrito no README. `lib/db.ts` usa `pg` em loopback e mantém Neon para o deploy. O servidor de desenvolvimento recusa banco remoto. Não copiar dados de clientes de produção para os testes.

## Validação

`pnpm check` valida tipos, lint e testes de schema, retomada, origem, geração, segurança, cache e limites. `pnpm build` valida o build de produção. Testar no navegador apresentação, fluxo completo, erro recuperável, campo livre, alteração de categoria, voltar/avançar, reload, checklist, pilares, pacotes e modal. Antes de lançar com checkout, testar também o navegador interno do Instagram em aparelhos reais e a atribuição de uma compra de afiliado.
