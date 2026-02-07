-- +goose Up

CREATE TABLE IF NOT EXISTS project_settings (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down

DROP TABLE IF EXISTS project_settings;

