-- Um QR Pix de uso único por pedido, com dados para reabrir a tela após recarregar.
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS asaas_pix_qr_id text UNIQUE;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS asaas_pix_payload text;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS asaas_pix_image text;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS asaas_pix_expires_at timestamptz;
-- Apenas para visualizar o pós-pagamento no desenvolvimento local, sem movimentação no Asaas.
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS asaas_pix_local_simulated_at timestamptz;
