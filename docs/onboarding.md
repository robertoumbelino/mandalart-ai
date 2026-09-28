# Jornada pública em /comecar

## Experiência

A jornada tem seis perguntas curtas, com avanço automático nas escolhas únicas. Antes da prévia com IA, a pessoa informa o e-mail. A prévia mostra o objetivo, um primeiro passo pessoal, parte do mapa e uma oferta principal: um Mandalart completo por R$ 37, pagamento único. O CTA abre diretamente o Stripe Checkout, sem exigir cadastro ou senha. Dentro do Checkout, há um adicional opcional de dois Mandalarts por R$ 62; o total com adicional é R$ 99. A loja `/sonhos` mantém suas ofertas existentes para contas autenticadas.

Após a confirmação do Stripe, o servidor cria ou vincula a conta, credita um ou três sonhos e associa a prévia ao pedido. Uma compra feita com e-mail que já pertence a uma conta exige o link enviado ao titular antes de abrir essa conta. Para uma conta nova, a página de retorno libera acesso no mesmo navegador e envia um link de uso único para abrir em outro aparelho. O primeiro plano completo é gerado automaticamente, usando o ID do pedido para evitar cobrança de crédito duplicada. A geração consome um sonho; os outros dois, quando comprados, ficam disponíveis no saldo.

## Retomada e e-mails

O rascunho local dura sete dias e a prévia pode ser retomada pelo link enviado ao e-mail. A primeira visualização agenda até dois lembretes, para 1 e 24 horas depois; compra e descadastro cancelam os envios pendentes. O link de descadastro exige confirmação por POST, para que scanners de e-mail não cancelem o envio ao abrir a mensagem. O Resend usa `RESEND_API_KEY` e `TRANSACTIONAL_EMAIL_FROM` com domínio verificado. Falha do provedor não bloqueia a entrega de uma compra paga; a página de retorno informa que o link ainda não foi enviado, e uma nova conciliação tenta novamente.

O link de acesso à conta dura 48 horas e só pode ser usado uma vez. O GET mostra uma confirmação sem consumi-lo; o POST cria uma sessão HttpOnly de 30 dias. O link da prévia dura sete dias. A sessão anônima da prévia usa cookie assinado e a mesma origem no retorno do pagamento.
Depois da expiração da sessão, `/acessar` permite solicitar outro link sem senha. A rota limita pedidos por hash de e-mail e rede e responde do mesmo modo para endereços com ou sem conta.

## Medição e segurança

`onboarding_events` registra etapas do funil no servidor, sem texto do sonho, respostas nem e-mail. Eventos de compra e adicional são gravados após a conciliação com o Stripe. O Pixel da Meta depende do consentimento para anúncios; o Purchase do navegador e o evento de servidor usam o mesmo `event_id` para deduplicação, se `META_CAPI_ACCESS_TOKEN` e `META_CAPI_API_VERSION` estiverem configurados. A origem de campanha é guardada no pedido.

A rota de prévia valida origem, tamanho, respostas e limites de geração (8 por sessão/hora, 20 por rede/hora, 1.000/dia). O checkout vincula pedido, sessão anônima, lead e prévia. O retorno só abre o pedido da mesma sessão e consulta o Stripe; a URL de sucesso não concede créditos sozinha. Reembolsos e contestações continuam usando a conciliação existente da carteira.

## Operação

A migration `007_conversion_journey.sql` adiciona leads, pedidos de visitante, tokens de acesso, eventos e a adaptação da conciliação. A produção usa preço live separado para o adicional em `STRIPE_PRICE_BUMP`; o preço local é test. Em desenvolvimento, use o Postgres `mandalart_local` e chaves Stripe test. Valide com `pnpm check`, `pnpm build` e uma compra de teste completa em 390 px. Não use dados de clientes de produção nos testes.
