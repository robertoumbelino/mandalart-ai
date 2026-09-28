-- Leads are tied to the anonymous, signed preview session. Email is never an auth credential.
CREATE TABLE IF NOT EXISTS onboarding_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  email text NOT NULL,
  answers jsonb NOT NULL,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  marketing_consent boolean NOT NULL DEFAULT false,
  preview_id uuid REFERENCES onboarding_previews(id) ON DELETE SET NULL,
  preview_viewed_at timestamptz,
  preview_email_sent_at timestamptz,
  recovery_scheduling_at timestamptz,
  recovery_one_email_id text,
  recovery_two_email_id text,
  recovery_one_sent_at timestamptz,
  recovery_two_sent_at timestamptz,
  recovery_unsubscribed_at timestamptz,
  purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT onboarding_leads_email CHECK (length(email) <= 254 AND email = lower(email))
);
CREATE INDEX IF NOT EXISTS onboarding_leads_session ON onboarding_leads(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS onboarding_leads_recovery ON onboarding_leads(created_at) WHERE purchased_at IS NULL;

-- Guest orders are associated with a real user only after Stripe confirms payment.
ALTER TABLE dream_orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES onboarding_leads(id) ON DELETE SET NULL;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS preview_id uuid REFERENCES onboarding_previews(id) ON DELETE SET NULL;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS guest_email text;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS bump_price_id text;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS access_email_sent_at timestamptz;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS access_email_sending_at timestamptz;
ALTER TABLE dream_orders ADD COLUMN IF NOT EXISTS browser_access_granted boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS dream_orders_lead ON dream_orders(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dream_orders_guest_email ON dream_orders(guest_email, created_at DESC);

-- One-time email links create a browser session for the account owner.
CREATE TABLE IF NOT EXISTS email_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS email_access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_access_sessions_user ON email_access_sessions(user_id, expires_at DESC);

-- First party events survive browser blockers and preserve campaign attribution.
CREATE TABLE IF NOT EXISTS onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid,
  lead_id uuid REFERENCES onboarding_leads(id) ON DELETE SET NULL,
  order_id uuid REFERENCES dream_orders(id) ON DELETE SET NULL,
  name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  attribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS onboarding_events_name_time ON onboarding_events(name, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_events_order_once ON onboarding_events(name, order_id)
  WHERE order_id IS NOT NULL AND name IN ('purchase_completed','order_bump_accepted');

-- Unpaid guest orders have no wallet. Paid orders receive a user before this runs.
CREATE OR REPLACE FUNCTION dream_reconcile_order(p_id uuid,p_paid boolean,p_refunded integer,p_disputed boolean,p_revision bigint,p_status text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE o dream_orders; target integer; change integer;
BEGIN
  SELECT * INTO o FROM dream_orders WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.user_id IS NULL AND p_paid THEN RAISE EXCEPTION 'Paid guest order has no account'; END IF;
  IF o.user_id IS NOT NULL THEN PERFORM dream_wallet_lock(o.user_id,o.mode); END IF;
  SELECT * INTO o FROM dream_orders WHERE id=p_id FOR UPDATE;
  o.paid := o.paid OR p_paid;
  o.refunded := greatest(o.refunded,p_refunded);
  IF p_revision>o.dispute_revision THEN
    o.disputed := p_disputed; o.dispute_revision := p_revision;
  ELSIF p_revision=o.dispute_revision THEN o.disputed := o.disputed OR p_disputed;
  END IF;
  target := CASE WHEN NOT o.paid OR o.disputed THEN 0 ELSE greatest(0,o.credits-ceil(o.refunded::numeric*o.credits/o.amount)::integer) END;
  change := target-o.credited;
  UPDATE dream_orders SET paid=o.paid,refunded=o.refunded,disputed=o.disputed,dispute_revision=o.dispute_revision,credited=target,
    status=CASE WHEN o.disputed THEN 'disputed' WHEN o.refunded>0 THEN 'refunded' WHEN o.paid THEN 'paid' ELSE p_status END,updated_at=now() WHERE id=p_id;
  IF change<>0 THEN
    UPDATE dream_wallets SET balance=balance+change WHERE user_id=o.user_id AND mode=o.mode;
    INSERT INTO dream_credit_ledger(user_id,mode,delta,reason,reference_id)
      VALUES(o.user_id,o.mode,change,CASE WHEN change>0 THEN 'purchase' ELSE 'payment_reversed' END,p_id);
  END IF;
  RETURN target;
END $$;
