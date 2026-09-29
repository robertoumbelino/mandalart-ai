# Jornada pública em /comecar

## Experiência

A jornada tem seis perguntas curtas, com avanço automático nas escolhas únicas. Ao terminar, a pessoa vê a prévia personalizada sem fornecer e-mail. A prévia mostra o objetivo, um primeiro passo pessoal, os oito caminhos do mapa e uma oferta principal: um Mandalart completo por R$ 37, pagamento único. O CTA abre diretamente o Stripe Checkout, sem exigir cadastro ou senha; o Stripe coleta o e-mail para entregar o acesso. Depois da oferta, a pessoa pode salvar a prévia por e-mail, opcionalmente. Dentro do Checkout, há um adicional opcional de dois Mandalarts por R$ 62; o total com adicional é R$ 99. A loja `/sonhos` mantém suas ofertas existentes para contas autenticadas.

Após a confirmação do Stripe, o servidor cria ou vincula a conta, credita um ou três sonhos e associa a prévia ao pedido. Uma compra feita com e-mail que já pertence a uma conta usa o login existente. Para uma conta nova, a página de retorno confirma a compra e orienta a abrir o e-mail com resumo do pedido e botão “Concluir meu cadastro”. O link de uso único abre `/finalizar-cadastro`, confirma a posse do e-mail e permite definir nome e senha no Neon Auth. A identidade é vinculada ao mesmo `users.id` da compra, preservando plano e créditos. O checkout não emite mais uma sessão autenticada automaticamente. O primeiro plano completo é gerado automaticamente, usando o ID do pedido para evitar cobrança de crédito duplicada. A geração consome um sonho; os outros dois, quando comprados, ficam disponíveis no saldo.

## Retomada e e-mails

O rascunho local dura sete dias. Se a pessoa optar por salvar a prévia após vê-la, ela pode retomá-la pelo link enviado ao e-mail; essa escolha agenda até dois lembretes, para 1 e 24 horas depois. Compra e descadastro cancelam os envios pendentes. O link de descadastro exige confirmação por POST, para que scanners de e-mail não cancelem o envio ao abrir a mensagem. O Resend usa `RESEND_API_KEY` e `TRANSACTIONAL_EMAIL_FROM` com domínio verificado. Falha do provedor não bloqueia a entrega de uma compra paga; a página de retorno informa que o link ainda não foi enviado, e uma nova conciliação tenta novamente.

O link de cadastro dura 48 horas e só pode ser usado uma vez. Abrir a página não consome o link; a conclusão reivindica o token e vincula a identidade em uma transação atômica, depois de autenticar a senha no provedor. Contas já cadastradas não têm a senha alterada por esse caminho. Links de acesso antigos para contas pendentes encaminham ao cadastro. `/acessar` reenvia as instruções, e “Esqueci minha senha” atende tanto cadastros pendentes quanto contas completas (estas usam a recuperação gerenciada pelo Neon Auth). As solicitações são limitadas por hash de e-mail e rede, com resposta genérica. O link da prévia dura sete dias. A sessão anônima da prévia usa cookie assinado e a mesma origem no retorno do pagamento.

Após confirmação de compra, o navegador remove o rascunho correspondente e registra a prévia comprada para impedir restauração em abas antigas. Um sonho diferente iniciado em outra aba não é apagado. A retomada no servidor também ignora prévias compradas. “Refazer do início” limpa respostas, prévia, progresso e e-mail local e retorna à primeira pergunta. Cada recomeço recebe um `attemptId` próprio: repetir as mesmas respostas não recupera os checks ou o pedido anterior pelo cache, enquanto tentativas de geração dentro do mesmo rascunho continuam usando o cache.

No desenvolvimento local (`NODE_ENV` diferente de `production` ou `LOCAL_DATABASE_ONLY=true`), os formulários e o checkout aceitam qualquer e-mail válido e conservam esse endereço na conta e no lead. Apenas o destinatário enviado à API do Resend é convertido para `delivered+<label>-<hash>@resend.dev`, para simular a entrega sem enviar à caixa real. O assunto inclui `[TESTE LOCAL: <e-mail original>]` para localizar o envio no painel. Endereços explícitos `delivered@resend.dev`, `bounced@resend.dev` e `complained@resend.dev`, inclusive labels como `delivered+compra@resend.dev`, conservam a simulação escolhida. Lembretes agendados ficam desativados no local. Configure uma chave restrita a envio em `.env.local` para testar; em produção, o destinatário e o assunto originais são mantidos.

## Medição e segurança

`onboarding_events` registra etapas do funil no servidor, sem texto do sonho, respostas nem e-mail. Eventos de compra e adicional são gravados após a conciliação com o Stripe. O Pixel da Meta depende do consentimento para anúncios; o Purchase do navegador e o evento de servidor usam o mesmo `event_id` para deduplicação, se `META_CAPI_ACCESS_TOKEN` e `META_CAPI_API_VERSION` estiverem configurados. A origem de campanha é guardada no pedido.

A rota de prévia valida origem, tamanho, respostas e limites de geração (8 por sessão/hora, 20 por rede/hora, 1.000/dia). O checkout vincula pedido e sessão anônima à prévia; o lead é opcional. O retorno só consulta o pedido da mesma sessão e confirma com o Stripe; a URL de sucesso não concede créditos nem autentica o comprador sozinha. Reembolsos e contestações continuam usando a conciliação existente da carteira.

## Operação

A migration `007_conversion_journey.sql` adiciona leads, pedidos de visitante, tokens de acesso, eventos e a adaptação da conciliação. A produção usa preço live separado para o adicional em `STRIPE_PRICE_BUMP`; o preço local é test. Em desenvolvimento, use o Postgres `mandalart_local` e chaves Stripe test. Valide com `pnpm check`, `pnpm build` e uma compra de teste completa em 390 px. Não use dados de clientes de produção nos testes.

## Atualização de conversão

Aplicar também `008_preview_continuity.sql` antes de publicar. Ela adiciona progresso da prévia e dados de consentimento/analytics ao pedido. Os três checks passam ao primeiro passo do plano pago. O plano abre na visão de execução e a matriz continua acessível. Ver `docs/conversion-checklist.md` para evidências, funis e pendências externas. A ausência de Pix na conta não é resolvida por uma flag local.
