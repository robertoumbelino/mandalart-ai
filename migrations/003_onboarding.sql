-- Prévia anônima: a sessão é identificada por cookie assinado, nunca pelo URL.
CREATE TABLE IF NOT EXISTS onboarding_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  input_hash TEXT NOT NULL,
  answers JSONB NOT NULL,
  attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview JSONB,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  UNIQUE (session_id, input_hash)
);
CREATE INDEX IF NOT EXISTS idx_onboarding_previews_expiry ON onboarding_previews (expires_at);

-- Limite persistente e atômico entre processos/instâncias. Não armazena IP bruto.
CREATE TABLE IF NOT EXISTS onboarding_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  resets_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_onboarding_rate_limits_expiry ON onboarding_rate_limits (resets_at);
