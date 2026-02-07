-- +goose Up

-- Organizations + memberships (M2)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- Add org_id to projects and backfill a default org for existing installs.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS org_id UUID;

-- Create a default org if we have any existing data and none exists yet.
INSERT INTO organizations (slug, name)
SELECT 'default', 'Default'
WHERE (SELECT COUNT(*) FROM organizations) = 0
  AND ((SELECT COUNT(*) FROM users) > 0 OR (SELECT COUNT(*) FROM projects) > 0);

-- Backfill project.org_id for existing rows.
UPDATE projects
SET org_id = (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1)
WHERE org_id IS NULL;

-- Make org_id required going forward.
ALTER TABLE projects
  ALTER COLUMN org_id SET NOT NULL;

-- Allow per-org slugs (drop old global uniqueness if present).
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_slug_key;

-- Prevent duplicate project slugs within an org.
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_org_slug ON projects(org_id, slug);

-- For MVP: keep repo_full_name unique globally to keep webhook routing simple.
ALTER TABLE projects
  ADD CONSTRAINT projects_repo_full_name_key UNIQUE (repo_full_name);

-- Membership for existing users: put everyone in the first org as owners.
INSERT INTO organization_memberships (org_id, user_id, role)
SELECT (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1), u.id, 'owner'
FROM users u
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON organization_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_created_at ON projects(org_id, created_at DESC);

-- +goose Down

DROP INDEX IF EXISTS idx_projects_org_created_at;
DROP INDEX IF EXISTS idx_org_memberships_org_id;
DROP INDEX IF EXISTS idx_org_memberships_user_id;

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_repo_full_name_key;

DROP INDEX IF EXISTS idx_projects_org_slug;

ALTER TABLE projects
  ADD CONSTRAINT projects_slug_key UNIQUE (slug);

ALTER TABLE projects
  DROP COLUMN IF EXISTS org_id;

DROP TABLE IF EXISTS organization_memberships;
DROP TABLE IF EXISTS organizations;

