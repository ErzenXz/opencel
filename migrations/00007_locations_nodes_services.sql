-- +goose Up

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  region TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(org_id);

CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'worker' CHECK (role IN ('primary','worker')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','online','offline')),
  agent_url TEXT,
  token_prefix TEXT,
  token_hash TEXT NOT NULL,
  token_enc BYTEA,
  hostname TEXT,
  agent_version TEXT,
  cpu_cores INT,
  memory_bytes BIGINT,
  last_seen_at TIMESTAMPTZ,
  last_metrics_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_nodes_org ON nodes(org_id);
CREATE INDEX IF NOT EXISTS idx_nodes_location ON nodes(location_id);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('postgres','redis','mysql','mongodb')),
  version TEXT NOT NULL DEFAULT 'latest',
  status TEXT NOT NULL DEFAULT 'provisioning' CHECK (status IN ('provisioning','running','stopped','failed','deleting')),
  container_name TEXT,
  internal_host TEXT,
  internal_port INT,
  username TEXT,
  database_name TEXT,
  password_enc BYTEA,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_services_org ON services(org_id);
CREATE INDEX IF NOT EXISTS idx_services_node ON services(node_id);

ALTER TABLE deployments ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS node_id UUID REFERENCES nodes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deployments_node ON deployments(node_id);

-- +goose Down

ALTER TABLE deployments DROP COLUMN IF EXISTS node_id;
ALTER TABLE deployments DROP COLUMN IF EXISTS location_id;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS nodes;
DROP TABLE IF EXISTS locations;
