-- +goose Up
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  repo_full_name TEXT NOT NULL,
  github_installation_id BIGINT,
  github_default_branch TEXT,
  production_deployment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_env_vars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('preview','production')),
  key TEXT NOT NULL,
  value_enc BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, scope, key)
);

CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  git_sha TEXT NOT NULL,
  git_ref TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('preview','production')),
  status TEXT NOT NULL,
  image_ref TEXT,
  container_name TEXT,
  service_port INT NOT NULL DEFAULT 3000,
  preview_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  promoted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS deployment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL,
  message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deployment_log_chunks (
  id BIGSERIAL PRIMARY KEY,
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  stream TEXT NOT NULL CHECK (stream IN ('build','runtime','system')),
  chunk TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deployments_project_created_at ON deployments(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployment_log_chunks_deployment_id ON deployment_log_chunks(deployment_id, id);

-- +goose Down
DROP TABLE IF EXISTS deployment_log_chunks;
DROP TABLE IF EXISTS deployment_events;
DROP TABLE IF EXISTS deployments;
DROP TABLE IF EXISTS project_env_vars;
DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS users;

