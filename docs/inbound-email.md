# Cópias dos e-mails de suporte

O webhook `POST /api/resend/webhook` encaminha uma cópia dos e-mails recebidos em `ola@mail.mandalart.com.br` para `INBOUND_EMAIL_FORWARD_TO`. A mensagem original permanece na Resend. A cópia inclui remetente, conteúdo, anexos e imagens embutidas; o `Reply-To` aponta para o remetente original. Responder pelo Gmail usa o endereço da conta Gmail.

Para habilitar em produção:

1. Aplique `migrations/013_inbound_email_forwards.sql`.
2. Configure uma chave Resend com **Full access** em `RESEND_RECEIVING_API_KEY`, separada de `RESEND_API_KEY`, que continua restrita ao envio transacional.
3. Configure `INBOUND_EMAIL_FORWARD_TO=beto.umbelino@gmail.com`.
4. Na Resend, crie um webhook para `https://mandalart.com.br/api/resend/webhook`, com somente o evento `email.received`. Salve seu segredo em `RESEND_RECEIVING_WEBHOOK_SECRET`.
5. Publique o código e teste um e-mail com anexo.

O corpo bruto é validado com a assinatura e o timestamp da Resend antes de processar o evento. O destino é definido no servidor; outros destinatários da conta Resend são ignorados. O banco armazena somente os identificadores da cópia enviada, impedindo novos envios de eventos já concluídos. A chave de idempotência da Resend cobre tentativas simultâneas e reentregas após falha temporária. Nenhum corpo de e-mail é salvo no banco ou nos logs do aplicativo.

Em desenvolvimento, o destino é convertido para o simulador `delivered+…@resend.dev`, seguindo a regra dos demais e-mails. Não habilite um webhook de produção em um túnel local. Sem as variáveis de recebimento, essa integração permanece desabilitada.

Referência: [encaminhamento com Resend Inbound](https://resend.com/docs/dashboard/receiving/forward-emails).
