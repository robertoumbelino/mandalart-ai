-- Saldo e reservas são separados por ambiente. Nenhum crédito de teste vale em produção.
CREATE TABLE IF NOT EXISTS dream_wallets (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('test','live')),
  balance integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, mode)
);
CREATE TABLE IF NOT EXISTS dream_orders (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('test','live')),
  provider text NOT NULL DEFAULT 'stripe',
  credits integer NOT NULL CHECK (credits IN (1,3)),
  amount integer NOT NULL CHECK (amount > 0),
  price_id text NOT NULL,
  session_id text UNIQUE,
  payment_intent_id text UNIQUE,
  paid boolean NOT NULL DEFAULT false,
  refunded integer NOT NULL DEFAULT 0 CHECK (refunded >= 0),
  disputed boolean NOT NULL DEFAULT false,
  dispute_revision bigint NOT NULL DEFAULT 0,
  credited integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dream_orders_user ON dream_orders(user_id, mode, created_at DESC);
CREATE TABLE IF NOT EXISTS dream_generations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('test','live')),
  input_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('generating','completed','failed')),
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);
CREATE INDEX IF NOT EXISTS dream_generations_pending ON dream_generations(user_id, mode, expires_at) WHERE status = 'generating';
CREATE TABLE IF NOT EXISTS dream_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('test','live')),
  delta integer NOT NULL,
  reason text NOT NULL,
  reference_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dream_ledger_user ON dream_credit_ledger(user_id, mode, created_at DESC);

-- Todas as operações de um usuário travam primeiro a carteira, inclusive devoluções.
CREATE OR REPLACE FUNCTION dream_wallet_lock(p_user uuid, p_mode text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO dream_wallets(user_id,mode) VALUES(p_user,p_mode) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM dream_wallets WHERE user_id=p_user AND mode=p_mode FOR UPDATE;
END $$;
CREATE OR REPLACE FUNCTION dream_release_expired(p_user uuid, p_mode text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE r record; b integer;
BEGIN
  PERFORM dream_wallet_lock(p_user,p_mode);
  FOR r IN UPDATE dream_generations SET status='failed'
    WHERE user_id=p_user AND mode=p_mode AND status='generating' AND expires_at<=now() RETURNING id
  LOOP
    UPDATE dream_wallets SET balance=balance+1 WHERE user_id=p_user AND mode=p_mode;
    INSERT INTO dream_credit_ledger(user_id,mode,delta,reason,reference_id) VALUES(p_user,p_mode,1,'generation_expired',r.id);
  END LOOP;
  SELECT balance INTO b FROM dream_wallets WHERE user_id=p_user AND mode=p_mode;
  RETURN b;
END $$;
CREATE OR REPLACE FUNCTION dream_reserve(p_user uuid,p_mode text,p_id uuid,p_hash text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r dream_generations; b integer;
BEGIN
  b := dream_release_expired(p_user,p_mode);
  SELECT * INTO r FROM dream_generations WHERE id=p_id;
  IF FOUND THEN
    IF r.user_id<>p_user OR r.mode<>p_mode OR r.input_hash<>p_hash THEN RAISE EXCEPTION 'Invalid generation request'; END IF;
    RETURN jsonb_build_object('status',r.status,'result',r.result);
  END IF;
  IF b<1 THEN RETURN jsonb_build_object('status','insufficient'); END IF;
  INSERT INTO dream_generations(id,user_id,mode,input_hash,status) VALUES(p_id,p_user,p_mode,p_hash,'generating');
  UPDATE dream_wallets SET balance=balance-1 WHERE user_id=p_user AND mode=p_mode;
  INSERT INTO dream_credit_ledger(user_id,mode,delta,reason,reference_id) VALUES(p_user,p_mode,-1,'generation_reserved',p_id);
  RETURN jsonb_build_object('status','reserved');
END $$;
CREATE OR REPLACE FUNCTION dream_fail(p_user uuid,p_mode text,p_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM dream_wallet_lock(p_user,p_mode);
  UPDATE dream_generations SET status='failed' WHERE id=p_id AND user_id=p_user AND mode=p_mode AND status='generating';
  IF FOUND THEN
    UPDATE dream_wallets SET balance=balance+1 WHERE user_id=p_user AND mode=p_mode;
    INSERT INTO dream_credit_ledger(user_id,mode,delta,reason,reference_id) VALUES(p_user,p_mode,1,'generation_failed',p_id);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION dream_complete(p_user uuid,p_mode text,p_id uuid,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r dream_generations; m mandalarts; output jsonb;
BEGIN
  PERFORM dream_release_expired(p_user,p_mode);
  SELECT * INTO r FROM dream_generations WHERE id=p_id AND user_id=p_user AND mode=p_mode FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Generation not found'; END IF;
  IF r.status='completed' THEN RETURN r.result; END IF;
  IF r.status<>'generating' THEN RETURN NULL; END IF;
  INSERT INTO mandalarts(user_id,main_goal,sub_goals) VALUES(p_user,p_data->>'mainGoal',p_data->'subGoals') RETURNING * INTO m;
  output := jsonb_build_object('id',m.id,'userId',p_user,'timestamp',floor(extract(epoch FROM m.created_at)*1000),'data',p_data);
  UPDATE dream_generations SET status='completed',result=output WHERE id=p_id;
  RETURN output;
END $$;
CREATE OR REPLACE FUNCTION dream_reconcile_order(p_id uuid,p_paid boolean,p_refunded integer,p_disputed boolean,p_revision bigint,p_status text) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE o dream_orders; target integer; change integer;
BEGIN
  SELECT * INTO o FROM dream_orders WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  PERFORM dream_wallet_lock(o.user_id,o.mode);
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
