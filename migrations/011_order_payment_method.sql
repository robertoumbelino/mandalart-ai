-- O checkout Asaas aceita Pix e cartão; registre o método confirmado para o histórico.
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS payment_method text;

-- Os QR Codes gerados pelo Mandalart são sempre Pix.
UPDATE dream_orders SET payment_method='PIX'
WHERE provider='asaas' AND asaas_pix_qr_id IS NOT NULL AND payment_method IS NULL;
