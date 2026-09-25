-- A identidade gerenciada pode ter outro UUID; os dados de produto preservam users.id.
CREATE TABLE IF NOT EXISTS auth_user_links (
  auth_user_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_user_links_user_id ON auth_user_links(user_id);
