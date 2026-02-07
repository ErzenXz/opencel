-- +goose Up

CREATE TABLE IF NOT EXISTS github_installations (
  id bigserial PRIMARY KEY,
  installation_id bigint NOT NULL UNIQUE,
  account_login text NOT NULL,
  account_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_github_installations (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  installation_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, installation_id)
);

CREATE INDEX IF NOT EXISTS github_installations_installation_id_idx ON github_installations(installation_id);

-- +goose Down

DROP TABLE IF EXISTS org_github_installations;
DROP TABLE IF EXISTS github_installations;

