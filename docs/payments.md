# Compra de sonhos

O saldo pertence à conta, independentemente do provedor de pagamento. Hoje o Stripe confirma compras; a Kiwify poderá usar o mesmo domínio de pedidos e créditos quando for integrada.

## Kiwify para novos visitantes de `/comecar`

O CTA do `/comecar` consulta a sessão no clique. Quem já está logado vai ao checkout Stripe da conta; visitantes passam por `actions/onboarding-checkout.ts`, que por enquanto também chama o Stripe. A compra iniciada diretamente em `/sonhos` continua no Stripe.

O checkout Kiwify fica desativado com `KIWIFY_ONBOARDING_ENABLED=false`. Configure os links completos das ofertas de 1 e 3 sonhos em `KIWIFY_CHECKOUT_ONE` e `KIWIFY_CHECKOUT_THREE` quando o produto for compartilhado. Cada oferta tem seu próprio link; use o link de afiliado com `afid` quando aplicável. `lib/kiwify-checkout.ts` preserva `afid` e outros parâmetros, acrescenta `email` e usa `sck` para o UUID do pedido; caso o link original já tenha `sck`, esse valor será substituído. Também são necessários `KIWIFY_PRODUCT_ID` e `KIWIFY_WEBHOOK_TOKEN`. Configurar esses valores por si só não altera o checkout ativo.

`POST /api/kiwify/webhook` confere a assinatura HMAC-SHA1 sobre o JSON, como descrito pela Kiwify, e só concilia eventos cujo `sck`, ID do produto, link da oferta, valor e moeda correspondem a um pedido local Kiwify. A migration 005 adiciona o ID externo da venda com unicidade. A mesma função de carteira do Stripe garante idempotência e reversão em reembolso ou chargeback. O retorno do navegador consulta o pedido da conta; a URL de retorno não concede créditos. O produto precisa ter uma página de obrigado direcionando a `/sonhos?origem=comecar` para a melhor experiência após a compra. Sem esse redirecionamento, a pessoa pode abrir `/sonhos` depois e consultar o saldo.

Em 24/09/2026, foi criado na conta Kiwify um produto interno separado, com ofertas de R$ 39,90 e R$ 99,90. Após a conclusão do cadastro da conta, os dois checkouts abriram com os preços corretos. O painel não apresentou um sandbox de pagamento. O recurso oficial **Testar Webhook** entregou um evento fictício de compra aprovada por HTTPS; a assinatura HMAC-SHA1 foi validada com o token gerado pela Kiwify. Esse evento fictício não contém `sck` nem `checkout_link` e usa outro ID de produto, portanto a aplicação deve ignorá-lo e não creditar um pedido. Os links foram desativados novamente após o teste, e nenhum webhook temporário foi salvo no painel. Os links e o ID do produto estão somente no `.env.local`; a ativação no app continua desligada. Testes locais validam assinatura, correlação do pedido, crédito idempotente e reversão em reembolso e chargeback. Antes de ligar a flag em produção, aplicar a migration 005 no banco de destino, configurar um webhook permanente para compra aprovada, reembolso e chargeback, testar uma compra aprovada real e seu estorno, e validar os links e permissões do produto compartilhado pelo influencer. Afiliados podem usar webhooks, mas os dados pessoais do comprador dependem da permissão do produtor; por isso é indispensável confirmar `sck` no evento recebido.

Teste sintético com o Postgres local, após aplicar a migration 005: em um terminal, `KIWIFY_WEBHOOK_TOKEN=local-kiwify-fixture pnpm exec next dev -p 3001`; em outro, `pnpm test:kiwify`. O script cria um usuário temporário, chama a rota HTTP com evento assinado e falso, repete a aprovação, envia reembolso e chargeback, verifica o saldo e remove o usuário. Não realiza cobrança na Kiwify. A execução de 24/09/2026 passou.

## Ofertas

- 1 sonho: R$ 39,90.
- 3 sonhos: R$ 99,90 (R$ 33,30 cada; economia de R$ 19,80).
- Compra avulsa em BRL. Criar um planner completo consome 1 sonho. Consultar planners existentes e atualizar progresso não consome créditos.
- Contas existentes começam com saldo zero e mantêm seus planners.

`/sonhos` oferece compra, saldo e extrato. O visitante de `/comecar` entra na conta antes do checkout. A prévia permanece no navegador e o retorno leva as respostas para o planner; nada é gerado ou consumido automaticamente ao pagar.

## Desenvolvimento local

1. Configure o Postgres local e aplique as migrations 001 a 004, em ordem. Nunca use a base de produção para simulações.
2. Configure `STRIPE_SECRET_KEY` com uma chave `sk_test_...` existente da conta. Não adicione segredos ao Git.
3. Execute `pnpm stripe:setup` para criar/reutilizar produto e preços de teste e salvar seus IDs no `.env.local`.
4. Instale a [Stripe CLI oficial](https://github.com/stripe/stripe-cli). Execute `pnpm stripe:listen` em um terminal separado. O script usa a chave do ambiente, conecta os eventos à rota local e grava `STRIPE_WEBHOOK_SECRET` sem exibi-lo. Deixe o processo rodando. O executável pode estar no PATH, em `~/.local/bin/stripe` ou em `STRIPE_CLI_PATH`.
5. Execute `pnpm dev` e use **http://localhost:3000** (a mesma origem de `APP_URL`, para manter a sessão no retorno).
6. Entre na conta, abra `/sonhos` e selecione “Escolher 1 sonho” ou “Escolher 3 sonhos”. O ambiente é determinado pela chave, sem avisos de teste na interface do Mandalart; o checkout Stripe identifica suas simulações.

No checkout de teste, use `4242 4242 4242 4242`, validade futura e qualquer CVC de três dígitos. Para simular recusa, use `4000 0000 0000 0002`. Para autenticação 3DS, use `4000 0025 0000 3155`. Nunca use dados de um cartão real nos testes. [Documentação dos cartões de teste](https://docs.stripe.com/testing).

Os créditos de teste são isolados dos reais pelo campo `mode`. O desenvolvimento, `LOCAL_DATABASE_ONLY=true` e os ambientes Vercel diferentes de Production recusam chaves live. Production na Vercel recusa chaves de teste. A chave pública não é necessária para o checkout hospedado. O retorno live exige `APP_URL` HTTPS configurada explicitamente e não aceita localhost.

### Pix

A integração aceita `card` e, quando habilitado, `pix`; não habilita boleto, Link ou outros métodos. Cartões de débito e pré-pagos são bloqueados pelo `funding_types_blocked` do Checkout. Uma configuração própria do Mandalart desativa também Apple Pay e Google Pay, sem alterar a configuração padrão da conta. O servidor verifica essa configuração antes de abrir o checkout.

Nesta conta, a API retorna `pix.available=false`. Portanto, `STRIPE_PIX_ENABLED=false`. Não habilite a variável antes de a Stripe liberar Pix na conta, inclusive no ambiente de teste. O Pix no Brasil depende de convite/liberação: [orientação oficial](https://support.stripe.com/questions/how-to-enable-pix-as-a-payment-method-in-brazil).

Após a liberação, habilite Pix na configuração “Mandalart — cartão e Pix” do painel, configure `STRIPE_PIX_ENABLED=true` no ambiente correspondente e teste QR Code, confirmação assíncrona, expiração e reembolso. Não foi possível validar um pagamento Pix real de teste enquanto a conta não tem acesso.

## Confirmação e integridade

`POST /api/stripe/webhook` verifica a assinatura sobre o corpo bruto. Eventos de checkout e de reembolso/contestação consultam novamente o Stripe; preços, valores, quantidade, usuário, pedido, moeda e ambiente precisam coincidir. Só uma sessão paga com PaymentIntent confirmado libera créditos. A consulta autenticada do retorno usa a mesma conciliação para recuperar confirmações perdidas, sem confiar na URL de sucesso.

As funções da migration 004 usam bloqueios na carteira para serializar conciliação, reservas e devoluções. Reentregas de webhook não somam créditos duas vezes. A criação do planner reserva 1 sonho com UUID e hash do pedido; uma repetição recupera a mesma geração. Planner e resultado são gravados atomicamente. Falhas devolvem a reserva uma vez; reservas abandonadas expiram após cinco minutos, recuperadas ao consultar a carteira. Uma resposta tardia não grava um planner depois dessa devolução.

Reembolso integral revoga os créditos do pedido. Em reembolso parcial, revoga-se proporcionalmente, arredondando para cima. Uma contestação bloqueia os créditos daquele pedido até encerramento favorável. Créditos já utilizados podem produzir saldo negativo, compensado em compras seguintes. Planners existentes permanecem acessíveis. O livro de movimentações explica cada ajuste.

Não há processo de reembolso dentro do aplicativo: os reembolsos são iniciados no Stripe. O webhook sincroniza o saldo. Mantenha entrega de eventos, logs e retentativas monitorados em produção.

## Validação

```bash
pnpm check
pnpm test:credits
pnpm build
```

`test:credits` exige `.env.local` apontando para localhost. Cria e remove somente seu próprio usuário temporário, validando concorrência de reservas, idempotência, devolução, expiração, persistência, reembolso, contestação e isolamento de ambientes em Postgres real.

## Produção — configuração separada

Para publicar, aplique a migration 004 no banco de destino e configure `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ONE`, `STRIPE_PRICE_THREE`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYMENT_CONFIGURATION`, `STRIPE_PIX_ENABLED` e `APP_URL` HTTPS com os valores daquele ambiente. Complete a ativação comercial da conta diretamente no Stripe. Produtos/preços test não servem para live.

Em 24/09/2026, a migration 004 foi validada na branch temporária `codex-stripe-migration-check` do projeto Neon `withered-fog-18712941` e aplicada na branch `main`. Os 4 usuários, 9 planners e 2 prévias existentes foram preservados. A branch de validação expira automaticamente após um dia. O desenvolvimento continua no Postgres local da porta 5432.

O projeto Vercel é `mandalart-ai`, com origem de produção `https://mandalart-ai.vercel.app`. As variáveis de teste estão limitadas ao ambiente Development; não copie segredos live para Preview ou Development. O segredo do webhook local é gerenciado pela Stripe CLI.

Na verificação de 24/09/2026, o cadastro Stripe estava enviado, mas cobranças e repasses continuavam desabilitados por pendências de verificação do representante. Após a confirmação do titular, a integração live foi configurada separadamente da integração de teste. Pix ainda retorna `available=false` em live e permanece desabilitado.

Recursos live da conta `acct_1Q1RivRriv7eBAzw`:

- Produto: `prod_VJoqQfKTP1cWpN`.
- 1 sonho, R$ 39,90: `price_1UJBDERriv7eBAzwjDoAHxxG`.
- 3 sonhos, R$ 99,90: `price_1UJBDERriv7eBAzwtEp9UoIi`.
- Configuração própria de métodos: `pmc_1UJBDFRriv7eBAzwmEzQz7Ue` (somente cartão; Pix aguarda liberação).
- Webhook: `we_1UJBDHRriv7eBAzwwMMXK5A1`, API `2026-08-26.dahlia`.

As variáveis `STRIPE_*` reais ficam somente em Production na Vercel. Os segredos não são versionados. A liberação cadastral do Stripe e uma compra real acompanhada ainda são necessárias antes de anunciar vendas.

Em 24/09/2026, o deployment `dpl_FRF4Q6MoYgz8kUVwXepNRXmq88Gu` foi promovido para `https://mandalart-ai.vercel.app`, e o webhook live foi habilitado. A rota de saúde respondeu 200; o webhook respondeu 200 a um evento técnico assinado sem efeito financeiro e 400 a uma chamada sem assinatura. A loja publicada foi verificada com sessão autenticada: ambos os preços corretos e compra desabilitada enquanto `charges_enabled=false`. Não houve cobrança real nem concessão artificial de créditos. Os 87 testes, lint, tipos e build passaram antes da publicação; o build remoto também passou.

Em live, a loja consulta `charges_enabled` da conta antes de oferecer compras. Se a conta estiver suspensa ou a consulta falhar, a compra fica indisponível, mas a consulta de créditos existentes e a conciliação do retorno de pagamento continuam independentes dessa disponibilidade. O ambiente de teste não depende da ativação comercial.

Cadastre um endpoint HTTPS `/api/stripe/webhook` na conta live, com estes eventos:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `charge.refunded`
- `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`

Use o segredo desse endpoint; o segredo da Stripe CLI é apenas local. O layout declara `maxDuration=180` segundos; confirme que o plano da hospedagem comporta esse limite para geração por IA e verifique o checkout, eventos e saldo no ambiente de destino antes de anunciar vendas.

## Verificação realizada em 23/09/2026

No Postgres local e no Stripe test: compra de 3 sonhos por R$ 99,90 e de 1 por R$ 39,90; recusa de cartão; cancelamento do checkout; webhook real da Stripe CLI com HTTP 200; reembolso do pacote de 1 sonho; interrupção com devolução automática; nova geração bem-sucedida, salva no histórico e debitada uma vez; expansão da prévia com os oito pilares e primeiro passo preservados. Interface inspecionada em 390 px. Nenhum pagamento real foi realizado.
