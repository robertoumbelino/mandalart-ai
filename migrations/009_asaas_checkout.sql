-- Limita consultas de status ao Asaas; os webhooks continuam sincronizando imediatamente.
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS provider_checked_at timestamptz;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz;
