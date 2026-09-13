-- Permite contas criadas exclusivamente pelo Google, sem senha local.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Mantém o identificador estável do provedor separado do e-mail, que pode mudar.
CREATE TABLE IF NOT EXISTS user_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_identities_provider_account_unique
    UNIQUE (provider, provider_account_id),
  CONSTRAINT user_identities_user_provider_unique
    UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id
  ON user_identities(user_id);
