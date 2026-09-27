-- Keep campaign attribution with the order, across hosted checkout redirects.
ALTER TABLE dream_orders
  ADD COLUMN IF NOT EXISTS attribution jsonb NOT NULL DEFAULT '{}'::jsonb;
