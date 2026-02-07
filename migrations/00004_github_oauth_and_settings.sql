-- +goose Up

-- GitHub OAuth + instance settings (DB-backed).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_instance_admin boolean NOT NULL DEFAULT false;

-- For existing installs, make the oldest user the instance admin.
WITH oldest AS (
  SELECT id FROM users ORDER BY created_at ASC LIMIT 1
)
UPDATE users SET is_instance_admin = true
WHERE id IN (SELECT id FROM oldest);

CREATE TABLE IF NOT EXISTS user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  provider_login text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS user_identities_user_id_idx ON user_identities(user_id);

CREATE TABLE IF NOT EXISTS github_oauth_tokens (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token_enc bytea NOT NULL,
  scopes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instance_settings (
  key text PRIMARY KEY,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_enc bytea NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Admin jobs for agent actions (apply/update) + logs.
CREATE TABLE IF NOT EXISTS admin_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- apply_settings | self_update
  status text NOT NULL, -- queued | running | success | failed
  created_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  error text NULL
);

CREATE TABLE IF NOT EXISTS admin_job_logs (
  id bigserial PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES admin_jobs(id) ON DELETE CASCADE,
  ts timestamptz NOT NULL DEFAULT now(),
  stream text NOT NULL DEFAULT 'system',
  chunk text NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_job_logs_job_id_idx ON admin_job_logs(job_id);

-- +goose Down

DROP TABLE IF EXISTS admin_job_logs;
DROP TABLE IF EXISTS admin_jobs;
DROP TABLE IF EXISTS instance_settings;
DROP TABLE IF EXISTS github_oauth_tokens;
DROP TABLE IF EXISTS user_identities;

ALTER TABLE users
  DROP COLUMN IF EXISTS is_instance_admin;

