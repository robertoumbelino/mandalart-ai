# Compra de sonhos

## Ofertas e acesso

A jornada `/comecar` vende um Mandalart completo por R$ 37,00 em pagamento único. A pessoa pode acrescentar dois sonhos por R$ 62,00 antes de pagar, totalizando R$ 99,00. A compra pública não exige cadastro ou senha. A loja autenticada `/sonhos` mantém as ofertas de 1 sonho por R$ 37,00 e 3 por R$ 99,90. No Stripe, que permanece disponível via `PAYMENT_PROVIDER=stripe`, o adicional também pode ser selecionado no próprio checkout usando `STRIPE_PRICE_BUMP`.

Depois que o provedor confirma o pagamento, a conciliação cria ou vincula a conta ao e-mail do checkout e credita a carteira. Se o e-mail já pertencia a uma conta, o retorno exige confirmação pelo link enviado àquele endereço. Para uma conta nova, o retorno cria acesso no navegador atual e envia um link de uso único para outro aparelho. O primeiro plano é gerado automaticamente usando o ID do pedido como chave de geração. Cada plano completo consome um crédito.

## Confirmação e integridade

`POST /api/asaas/webhook` valida o cabeçalho `asaas-access-token` e consulta o pagamento novamente no Asaas. A conciliação confere checkout ou ID do QR Code, método e valor. Para Stripe, `POST /api/stripe/webhook` continua validando a assinatura do corpo bruto e consultando a Stripe; a conciliação também confere modo, pedido, preço, moeda, quantidade e valor. A URL de sucesso não concede créditos. `GET /api/onboarding/payment` exige a sessão anônima que iniciou a compra e consulta o estado autoritativo antes de liberar o retorno.

A função `dream_reconcile_order` mantém a carteira idempotente: reentrega de webhook não duplica créditos. Reembolso integral revoga os créditos do pedido; em reembolso parcial, a revogação é proporcional. Uma contestação bloqueia os créditos daquele pedido até a resolução. Créditos já usados podem produzir saldo negativo, compensado em compras seguintes. Planos salvos continuam acessíveis. A página `/reembolso` permite solicitar estorno integral em até sete dias, conforme os termos.

A migration 007 permite `dream_orders.user_id` nulo enquanto o pedido público não foi pago. Depois da confirmação, o pedido recebe o usuário e a carteira é conciliada. `browser_access_granted` impede que alguém obtenha acesso a uma conta preexistente apenas pagando com o e-mail dela. Links de e-mail são de uso único, expiram em 48 horas e requerem confirmação por POST. A sessão criada dura 30 dias.

## E-mail e mensuração

O Resend envia a prévia, dois lembretes opcionais e o link após a compra. Variáveis: `RESEND_API_KEY` e `TRANSACTIONAL_EMAIL_FROM`. O domínio remetente deve estar verificado antes de liberar a jornada pública. Falhas de e-mail são registradas e não desfazem uma compra paga; uma nova conciliação pode tentar novamente. A página de retorno informa se o link ainda não foi enviado.

Eventos de funil são gravados em `onboarding_events` e a origem de campanha fica em `dream_orders.attribution`. O Pixel da Meta depende do consentimento. Quando `META_CAPI_ACCESS_TOKEN` e `META_CAPI_API_VERSION` estão configurados, o servidor envia Purchase com o mesmo `event_id` do navegador para deduplicação. O e-mail é enviado à Meta apenas em hash SHA-256 e somente com consentimento. Eventos de analytics não incluem o sonho nem as respostas.

## Ambientes e testes

Selecione o provedor com `PAYMENT_PROVIDER=asaas` ou `PAYMENT_PROVIDER=stripe`. Desenvolvimento e Preview aceitam apenas chaves de teste; Production aceita apenas chaves de produção e exige `APP_URL` HTTPS. Não copie segredos de produção para Preview ou Development. As migrations `009_asaas_checkout.sql` e `010_asaas_direct_pix.sql` são necessárias antes de testar ambos os fluxos Asaas.

Para Asaas, configure `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `APP_URL`. O webhook deve apontar para `<APP_URL>/api/asaas/webhook` e usar o mesmo token de autenticação. Assine eventos de checkout, pagamento, estorno e contestação; o servidor reconsulta o Asaas antes de creditar ou revogar créditos. A conta precisa ter Pix e cartão habilitados e uma chave Pix cadastrada no próprio Asaas. O checkout hospedado oferece ambos os métodos e coleta os dados do pagador. No fluxo público, o adicional de R$ 62 aparece antes da saída para o checkout.

Para oferecer Pix com apenas e-mail e forma de pagamento no Mandalart, configure `ASAAS_DIRECT_PIX_ENABLED=true` e `ASAAS_PIX_KEY` com a chave Pix EVP ativa da mesma conta e ambiente da API key. Em produção, habilite a flag somente depois de configurar e testar o webhook de produção com uma compra real. A aplicação cria um QR Code estático de valor fixo, uso único e validade de uma hora; `/pix` exibe QR e Copia e Cola, e consulta o pagamento enquanto a página estiver aberta. O pedido guarda o e-mail informado para entregar o acesso após a confirmação. O cartão continua abrindo o checkout hospedado do Asaas, onde os dados exigidos pelo provedor ainda aparecem. O QR Code não cria uma cobrança antecipadamente; quando ele é pago, o Asaas cria uma cobrança com `pixQrCodeId`, usada pelo webhook e pela conciliação para vincular o pedido.

O Sandbox local usa `https://api-sandbox.asaas.com/v3`; uma chave de produção usa `https://api.asaas.com/v3`. O Asaas requer URLs HTTPS de sucesso, cancelamento e expiração distintas. Para testar localmente, encaminhe a porta 3000 por um túnel HTTPS, use a URL pública em `APP_URL`, aponte o webhook do Sandbox para essa mesma URL, inicie `pnpm dev` e abra o Mandalart pela URL HTTPS. O `next.config.ts` libera apenas o host configurado em `APP_URL` para os recursos de desenvolvimento e as Server Actions. Os links enviados por e-mail em testes locais usam `LOCAL_APP_URL` (padrão `http://localhost:3000`), pois a conclusão do cadastro deve ocorrer no servidor local; o túnel continua reservado aos retornos e webhooks do Asaas. Se a porta local for diferente, ajuste `LOCAL_APP_URL`. Se o endereço do túnel mudar, atualize `APP_URL` e o webhook e reinicie `pnpm dev` antes do próximo teste. A chave de API e o token ficam apenas em `.env.local` ou em segredos do deploy, nunca no Git. Para confirmar Pix no Sandbox, use a simulação de pagamento do próprio Asaas; para cartão, use um cartão de teste documentado pelo Asaas.

O Sandbox foi testado localmente com Pix e cartão: o checkout abriu os dois métodos, a confirmação por webhook marcou o pedido como pago e a carteira recebeu um único crédito. Para publicar a integração em produção: configure `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_PIX_KEY` como segredos de Production; crie um webhook v3 autenticado para `https://mandalart.com.br/api/asaas/webhook` com os eventos de checkout, pagamento, estorno e contestação; aplique as migrations antes do deploy. Publique o código com o provedor anterior, confira a resposta autenticada do endpoint, ative o webhook, defina `PAYMENT_PROVIDER=asaas` e `ASAAS_DIRECT_PIX_ENABLED=true` e faça um novo deploy. Valide cartão e Pix com pagamentos reais controlados antes de divulgar o checkout.

O Pix direto foi testado na API e na página `/pix` com um QR Code real do Sandbox; a cópia do código funcionou. A liquidação desse novo fluxo ainda requer uma segunda conta Sandbox com saldo para pagar o QR Code, conforme a [documentação de testes do Asaas](https://docs.asaas.com/docs/testar-pagamento-de-qrcodes-pix). O teste de liquidação citado acima refere-se ao checkout hospedado.

Para revisar o pós-pagamento sem criar outra conta Sandbox, `ASAAS_PIX_LOCAL_SIMULATION=true` mostra um botão na página `/pix` apenas em desenvolvimento servido por `localhost:3000` com `LOCAL_DATABASE_ONLY=true` e Postgres local. Ele marca o pedido de teste como pago no banco local e executa a mesma entrega de créditos e acesso, mas não paga o QR Code nem gera uma confirmação no Asaas. O endpoint rejeita origem e host externos. Este teste valida a interface e a entrega interna; a liquidação real do QR Code permanece pendente da segunda conta Sandbox.

Para Stripe, configure `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ONE`, `STRIPE_PRICE_THREE`, `STRIPE_PRICE_BUMP`, `STRIPE_PAYMENT_CONFIGURATION`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PIX_ENABLED` e `APP_URL` para o ambiente correto. O Pix na Stripe permanece condicionado à liberação na conta.

Para testar Stripe, execute `pnpm stripe:setup` e `pnpm stripe:listen`; depois `pnpm dev` em `http://localhost:3000`. Use os cartões da [documentação oficial da Stripe](https://docs.stripe.com/testing). Valide `pnpm check`, `pnpm test:credits` e `pnpm build` antes de publicar.

A Kiwify continua desativada (`KIWIFY_ONBOARDING_ENABLED=false`). O código legado de integração e conciliação permanece para eventual uso futuro, mas não participa da jornada pública atual. Qualquer ativação exige verificar produto, links de afiliado, webhook, aprovação real, estorno e experiência de acesso antes de alterar a flag.

## Recursos live existentes

Conta Stripe: `acct_1Q1RivRriv7eBAzw`. Preço principal: `price_1UJjBBRriv7eBAzwOBoXztmN` (R$ 37). Pacote autenticado de 3: `price_1UJBDERriv7eBAzwtEp9UoIi` (R$ 99,90). Adicional público: `price_1UKcLIRriv7eBAzwtEzqEclZ` (R$ 62). Configuração de métodos: `pmc_1UJBDFRriv7eBAzwmEzQz7Ue`. O webhook live já existente recebe os eventos de confirmação e reversão. Nenhuma compra real foi simulada para validar a produção; use test mode para QA e acompanhe a primeira venda real.
