-- Apply before deploying the conversion update. No financial balances change.
ALTER TABLE onboarding_previews ADD COLUMN IF NOT EXISTS checked jsonb NOT NULL DEFAULT '[false,false,false]'::jsonb
  CHECK (jsonb_typeof(checked) = 'array' AND jsonb_array_length(checked) = 3);
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS journey_version text;
ALTER TABLE onboarding_events ADD COLUMN IF NOT EXISTS preview_id uuid REFERENCES onboarding_previews(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS onboarding_events_preview_idx ON onboarding_events(preview_id,created_at);
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS analytics_distinct_id text;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS purchase_confirmed_at timestamptz;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS product_event_sent_at timestamptz;
