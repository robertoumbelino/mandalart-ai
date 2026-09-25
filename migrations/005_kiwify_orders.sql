-- Identificador da venda na Kiwify. O pedido interno continua sendo o UUID em id.
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS external_order_id text;
CREATE UNIQUE INDEX IF NOT EXISTS dream_orders_external_provider_order
  ON dream_orders(provider, external_order_id)
  WHERE external_order_id IS NOT NULL;
