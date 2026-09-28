# Compra de sonhos

## Ofertas e acesso

A jornada `/comecar` vende um Mandalart completo por R$ 37,00 em pagamento único. No Stripe Checkout, a pessoa pode acrescentar dois sonhos por R$ 62,00, totalizando R$ 99,00. A compra pública não exige cadastro ou senha. A loja autenticada `/sonhos` mantém as ofertas de 1 sonho por R$ 37,00 e 3 por R$ 99,90. O adicional público usa `STRIPE_PRICE_BUMP`, um preço Stripe separado para cada ambiente.

Depois que o Stripe confirma o PaymentIntent, a conciliação cria ou vincula a conta ao e-mail do checkout e credita a carteira. Se o e-mail já pertencia a uma conta, o retorno exige confirmação pelo link enviado àquele endereço. Para uma conta nova, o retorno cria acesso no navegador atual e envia um link de uso único para outro aparelho. O primeiro plano é gerado automaticamente usando o ID do pedido como chave de geração. Cada plano completo consome um crédito.

## Confirmação e integridade

`POST /api/stripe/webhook` valida a assinatura do corpo bruto. Eventos de checkout, reembolso e contestação consultam novamente a Stripe. A conciliação compara modo, pedido, preço, moeda, quantidade e valor de cada item; a oferta pública aceita apenas R$ 37 ou R$ 37 + R$ 62. A URL de sucesso não concede créditos. `GET /api/onboarding/payment` exige a sessão anônima que iniciou a compra e consulta o estado autoritativo antes de liberar o retorno.

A função `dream_reconcile_order` mantém a carteira idempotente: reentrega de webhook não duplica créditos. Reembolso integral revoga os créditos do pedido; em reembolso parcial, a revogação é proporcional. Uma contestação bloqueia os créditos daquele pedido até a resolução. Créditos já usados podem produzir saldo negativo, compensado em compras seguintes. Planos salvos continuam acessíveis. A página `/reembolso` permite solicitar estorno integral em até sete dias, conforme os termos.

A migration 007 permite `dream_orders.user_id` nulo enquanto o pedido público não foi pago. Depois da confirmação, o pedido recebe o usuário e a carteira é conciliada. `browser_access_granted` impede que alguém obtenha acesso a uma conta preexistente apenas pagando com o e-mail dela. Links de e-mail são de uso único, expiram em 48 horas e requerem confirmação por POST. A sessão criada dura 30 dias.

## E-mail e mensuração

O Resend envia a prévia, dois lembretes opcionais e o link após a compra. Variáveis: `RESEND_API_KEY` e `TRANSACTIONAL_EMAIL_FROM`. O domínio remetente deve estar verificado antes de liberar a jornada pública. Falhas de e-mail são registradas e não desfazem uma compra paga; uma nova conciliação pode tentar novamente. A página de retorno informa se o link ainda não foi enviado.

Eventos de funil são gravados em `onboarding_events` e a origem de campanha fica em `dream_orders.attribution`. O Pixel da Meta depende do consentimento. Quando `META_CAPI_ACCESS_TOKEN` e `META_CAPI_API_VERSION` estão configurados, o servidor envia Purchase com o mesmo `event_id` do navegador para deduplicação. O e-mail é enviado à Meta apenas em hash SHA-256 e somente com consentimento. Eventos de analytics não incluem o sonho nem as respostas.

## Ambientes e testes

Desenvolvimento e Preview aceitam apenas Stripe test. Production aceita apenas Stripe live e exige `APP_URL` HTTPS. Não copie segredos live para Preview ou Development. Configure `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ONE`, `STRIPE_PRICE_THREE`, `STRIPE_PRICE_BUMP`, `STRIPE_PAYMENT_CONFIGURATION`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PIX_ENABLED` e `APP_URL` para o ambiente correto. Pix permanece desativado até liberação pela Stripe e teste do fluxo assíncrono.

Para preparar preços de teste, execute `pnpm stripe:setup`. Para receber webhooks locais, execute `pnpm stripe:listen`; depois `pnpm dev` em `http://localhost:3000`. Use o cartão de teste `4242 4242 4242 4242`, validade futura e CVC fictício. Para simular recusa, use `4000 0000 0000 0002`. Consulte a [documentação oficial da Stripe](https://docs.stripe.com/testing). Valide `pnpm check`, `pnpm test:credits` e `pnpm build` antes de publicar.

A Kiwify continua desativada (`KIWIFY_ONBOARDING_ENABLED=false`). O código legado de integração e conciliação permanece para eventual uso futuro, mas não participa da jornada pública atual. Qualquer ativação exige verificar produto, links de afiliado, webhook, aprovação real, estorno e experiência de acesso antes de alterar a flag.

## Recursos live existentes

Conta Stripe: `acct_1Q1RivRriv7eBAzw`. Preço principal: `price_1UJjBBRriv7eBAzwOBoXztmN` (R$ 37). Pacote autenticado de 3: `price_1UJBDERriv7eBAzwtEp9UoIi` (R$ 99,90). Adicional público: `price_1UKcLIRriv7eBAzwtEzqEclZ` (R$ 62). Configuração de métodos: `pmc_1UJBDFRriv7eBAzwmEzQz7Ue`. O webhook live já existente recebe os eventos de confirmação e reversão. Nenhuma compra real foi simulada para validar a produção; use test mode para QA e acompanhe a primeira venda real.
