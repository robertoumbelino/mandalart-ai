-- Planos são preservados, mas o acesso acompanha os créditos da compra de origem.
ALTER TABLE mandalarts ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','disabled'));
ALTER TABLE mandalarts ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
ALTER TABLE mandalarts ADD COLUMN IF NOT EXISTS disabled_reason text;
ALTER TABLE dream_generations ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES dream_orders(id);
ALTER TABLE dream_generations ADD COLUMN IF NOT EXISTS order_credit integer CHECK (order_credit BETWEEN 1 AND 3);
CREATE INDEX IF NOT EXISTS dream_generations_order ON dream_generations(order_id,created_at,id);

-- O saldo antigo era fungível. Reconstruímos a origem por ordem de pagamento (FIFO),
-- considerando somente créditos que existiam no instante de cada reserva.
DO $$
DECLARE r record; source_order uuid; source_credit integer;
BEGIN
  FOR r IN SELECT * FROM dream_generations
    WHERE order_id IS NULL AND status IN ('completed','generating') ORDER BY created_at,id
  LOOP
    SELECT o.id,slot.credit INTO source_order,source_credit FROM dream_orders o
    JOIN LATERAL (
      SELECT min(created_at) AS paid_at, sum(delta) AS available
      FROM dream_credit_ledger
      WHERE reference_id=o.id AND mode=o.mode AND reason IN ('purchase','payment_reversed')
        AND created_at<=r.created_at
    ) payment ON payment.available>0
    JOIN LATERAL (
      SELECT credit FROM generate_series(1,payment.available::integer) credit
      WHERE NOT EXISTS (SELECT 1 FROM dream_generations g WHERE g.order_id=o.id
        AND g.order_credit=credit AND g.status IN ('completed','generating'))
      ORDER BY credit LIMIT 1
    ) slot ON true
    WHERE o.user_id=r.user_id AND o.mode=r.mode
    ORDER BY payment.paid_at,o.id LIMIT 1;
    IF source_order IS NOT NULL THEN
      UPDATE dream_generations SET order_id=source_order,order_credit=source_credit WHERE id=r.id;
    END IF;
  END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS dream_generations_order_credit ON dream_generations(order_id,order_credit)
  WHERE status IN ('completed','generating');

CREATE OR REPLACE FUNCTION dream_sync_order_plans(p_id uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  WITH access AS (
    SELECT g.result->>'id' AS plan_id, g.user_id,
      g.order_credit>o.credited AS disabled
    FROM dream_generations g JOIN dream_orders o ON o.id=g.order_id
    WHERE o.id=p_id AND g.status IN ('completed','generating')
  )
  UPDATE mandalarts m SET
    status=CASE WHEN a.disabled THEN 'disabled' ELSE 'active' END,
    disabled_at=CASE WHEN a.disabled THEN COALESCE(m.disabled_at,now()) ELSE NULL END,
    disabled_reason=CASE WHEN a.disabled THEN 'payment_reversed' ELSE NULL END,
    updated_at=now()
  FROM access a WHERE m.id::text=a.plan_id AND m.user_id=a.user_id
    AND (m.status='active' OR m.disabled_reason='payment_reversed')
    AND m.status IS DISTINCT FROM CASE WHEN a.disabled THEN 'disabled' ELSE 'active' END;
END $$;

CREATE OR REPLACE FUNCTION dream_order_plan_access() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM dream_sync_order_plans(NEW.id);
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER dream_order_plan_access
  AFTER UPDATE OF credited ON dream_orders
  FOR EACH ROW WHEN (OLD.credited IS DISTINCT FROM NEW.credited)
  EXECUTE FUNCTION dream_order_plan_access();

CREATE OR REPLACE FUNCTION dream_reserve(p_user uuid,p_mode text,p_id uuid,p_hash text,p_order uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r dream_generations; b integer; source_order uuid; source_credit integer;
BEGIN
  b := dream_release_expired(p_user,p_mode);
  SELECT * INTO r FROM dream_generations WHERE id=p_id;
  IF FOUND THEN
    IF r.user_id<>p_user OR r.mode<>p_mode OR r.input_hash<>p_hash THEN RAISE EXCEPTION 'Invalid generation request'; END IF;
    IF r.status='completed' AND NOT EXISTS (
      SELECT 1 FROM mandalarts WHERE id::text=r.result->>'id' AND user_id=p_user AND status='active'
    ) THEN RETURN jsonb_build_object('status','disabled'); END IF;
    RETURN jsonb_build_object('status',r.status,'result',r.result);
  END IF;
  IF b<1 THEN RETURN jsonb_build_object('status','insufficient'); END IF;
  SELECT o.id,slot.credit INTO source_order,source_credit FROM dream_orders o
  JOIN LATERAL (
    SELECT min(created_at) AS paid_at FROM dream_credit_ledger
    WHERE reference_id=o.id AND mode=o.mode AND reason='purchase'
  ) payment ON true
  JOIN LATERAL (
    SELECT credit FROM generate_series(1,o.credited) credit
    WHERE NOT EXISTS (SELECT 1 FROM dream_generations g WHERE g.order_id=o.id
      AND g.order_credit=credit AND g.status IN ('completed','generating'))
    ORDER BY credit LIMIT 1
  ) slot ON true
  WHERE o.user_id=p_user AND o.mode=p_mode AND o.paid AND NOT o.disputed
    AND (p_order IS NULL OR o.id=p_order)
  ORDER BY payment.paid_at,o.id LIMIT 1;
  IF source_order IS NULL THEN RETURN jsonb_build_object('status','insufficient'); END IF;
  INSERT INTO dream_generations(id,user_id,mode,input_hash,status,order_id,order_credit)
    VALUES(p_id,p_user,p_mode,p_hash,'generating',source_order,source_credit);
  UPDATE dream_wallets SET balance=balance-1 WHERE user_id=p_user AND mode=p_mode;
  INSERT INTO dream_credit_ledger(user_id,mode,delta,reason,reference_id)
    VALUES(p_user,p_mode,-1,'generation_reserved',p_id);
  RETURN jsonb_build_object('status','reserved');
END $$;

-- Mantém compatibilidade com a versão anterior durante o deploy.
CREATE OR REPLACE FUNCTION dream_reserve(p_user uuid,p_mode text,p_id uuid,p_hash text)
RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  RETURN dream_reserve(p_user,p_mode,p_id,p_hash,NULL::uuid);
END $$;

CREATE OR REPLACE FUNCTION dream_complete(p_user uuid,p_mode text,p_id uuid,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r dream_generations; m mandalarts; output jsonb; granted integer;
BEGIN
  PERFORM dream_release_expired(p_user,p_mode);
  SELECT * INTO r FROM dream_generations WHERE id=p_id AND user_id=p_user AND mode=p_mode FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Generation not found'; END IF;
  IF r.status='completed' THEN
    IF EXISTS (SELECT 1 FROM mandalarts WHERE id::text=r.result->>'id' AND user_id=p_user AND status='active')
      THEN RETURN r.result; END IF;
    RETURN NULL;
  END IF;
  IF r.status<>'generating' THEN RETURN NULL; END IF;
  IF r.order_id IS NOT NULL THEN
    SELECT credited INTO granted FROM dream_orders WHERE id=r.order_id AND user_id=p_user AND mode=p_mode;
    IF granted IS NULL OR r.order_credit>granted THEN
      PERFORM dream_fail(p_user,p_mode,p_id);
      RETURN NULL;
    END IF;
  END IF;
  INSERT INTO mandalarts(user_id,main_goal,sub_goals)
    VALUES(p_user,p_data->>'mainGoal',p_data->'subGoals') RETURNING * INTO m;
  output := jsonb_build_object('id',m.id,'userId',p_user,'timestamp',floor(extract(epoch FROM m.created_at)*1000),'data',p_data);
  UPDATE dream_generations SET status='completed',result=output WHERE id=p_id;
  RETURN output;
END $$;
