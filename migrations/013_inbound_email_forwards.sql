-- Guarda somente a confirmação de envio; o conteúdo original permanece na Resend.
CREATE TABLE IF NOT EXISTS inbound_email_forwards (
  email_id uuid NOT NULL,
  recipient text NOT NULL,
  sent_email_id uuid NOT NULL,
  forwarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email_id,recipient)
);
