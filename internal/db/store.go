package db

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Store struct {
	DB *sql.DB
}

type User struct {
	ID           string
	Email        string
	PasswordHash string
	CreatedAt    time.Time
}

type Project struct {
	ID                   string
	Slug                 string
	RepoFullName         string
	GitHubInstallationID sql.NullInt64
	GitHubDefaultBranch  sql.NullString
	ProductionDeploymentID sql.NullString
	CreatedAt            time.Time
}

type Deployment struct {
	ID            string
	ProjectID     string
	GitSHA        string
	GitRef        string
	Type          string
	Status        string
	ImageRef      sql.NullString
	ContainerName sql.NullString
	ServicePort   int
	PreviewURL    sql.NullString
	CreatedAt     time.Time
	UpdatedAt     time.Time
	PromotedAt    sql.NullTime
}

type DeploymentLogChunk struct {
	ID           int64
	DeploymentID string
	TS           time.Time
	Stream       string
	Chunk        string
}

type EnvVar struct {
	ID        string
	ProjectID string
	Scope     string
	Key       string
	ValueEnc  []byte
	CreatedAt time.Time
}

func NewStore(db *sql.DB) *Store {
	return &Store{DB: db}
}

func (s *Store) CountUsers(ctx context.Context) (int, error) {
	var n int
	if err := s.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

func (s *Store) CreateUser(ctx context.Context, email, passwordHash string) (*User, error) {
	var u User
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO users (email, password_hash)
		VALUES ($1, $2)
		RETURNING id, email, password_hash, created_at
	`, email, passwordHash).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, email, password_hash, created_at
		FROM users
		WHERE email = $1
	`, email).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) GetUserByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, email, password_hash, created_at
		FROM users
		WHERE id = $1
	`, id).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) CreateProject(ctx context.Context, slug, repoFullName string, installationID *int64, defaultBranch *string) (*Project, error) {
	var p Project
	var inst sql.NullInt64
	var def sql.NullString
	if installationID != nil {
		inst = sql.NullInt64{Int64: *installationID, Valid: true}
	}
	if defaultBranch != nil {
		def = sql.NullString{String: *defaultBranch, Valid: true}
	}
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO projects (slug, repo_full_name, github_installation_id, github_default_branch)
		VALUES ($1, $2, $3, $4)
		RETURNING id, slug, repo_full_name, github_installation_id, github_default_branch, production_deployment_id, created_at
	`, slug, repoFullName, inst, def).Scan(
		&p.ID, &p.Slug, &p.RepoFullName, &p.GitHubInstallationID, &p.GitHubDefaultBranch, &p.ProductionDeploymentID, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Store) ListProjects(ctx context.Context) ([]Project, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, slug, repo_full_name, github_installation_id, github_default_branch, production_deployment_id, created_at
		FROM projects
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Slug, &p.RepoFullName, &p.GitHubInstallationID, &p.GitHubDefaultBranch, &p.ProductionDeploymentID, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) GetProject(ctx context.Context, id string) (*Project, error) {
	var p Project
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, slug, repo_full_name, github_installation_id, github_default_branch, production_deployment_id, created_at
		FROM projects
		WHERE id = $1
	`, id).Scan(&p.ID, &p.Slug, &p.RepoFullName, &p.GitHubInstallationID, &p.GitHubDefaultBranch, &p.ProductionDeploymentID, &p.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Store) GetProjectByRepoFullName(ctx context.Context, repoFullName string) (*Project, error) {
	var p Project
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, slug, repo_full_name, github_installation_id, github_default_branch, production_deployment_id, created_at
		FROM projects
		WHERE repo_full_name = $1
	`, repoFullName).Scan(&p.ID, &p.Slug, &p.RepoFullName, &p.GitHubInstallationID, &p.GitHubDefaultBranch, &p.ProductionDeploymentID, &p.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Store) CreateDeployment(ctx context.Context, projectID, gitSHA, gitRef, typ string) (*Deployment, error) {
	var d Deployment
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO deployments (project_id, git_sha, git_ref, type, status)
		VALUES ($1, $2, $3, $4, 'QUEUED')
		RETURNING id, project_id, git_sha, git_ref, type, status, image_ref, container_name, service_port, preview_url, created_at, updated_at, promoted_at
	`, projectID, gitSHA, gitRef, typ).Scan(
		&d.ID, &d.ProjectID, &d.GitSHA, &d.GitRef, &d.Type, &d.Status,
		&d.ImageRef, &d.ContainerName, &d.ServicePort, &d.PreviewURL, &d.CreatedAt, &d.UpdatedAt, &d.PromotedAt,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (s *Store) UpdateDeployment(ctx context.Context, deploymentID string, status string, imageRef *string, containerName *string, servicePort *int, previewURL *string) error {
	_, err := s.DB.ExecContext(ctx, `
		UPDATE deployments
		SET status = COALESCE($2, status),
		    image_ref = COALESCE($3, image_ref),
		    container_name = COALESCE($4, container_name),
		    service_port = COALESCE($5, service_port),
		    preview_url = COALESCE($6, preview_url),
		    updated_at = now()
		WHERE id = $1
	`, deploymentID, nullString(status), nullStringPtr(imageRef), nullStringPtr(containerName), nullIntPtr(servicePort), nullStringPtr(previewURL))
	return err
}

func (s *Store) AddDeploymentEvent(ctx context.Context, deploymentID, typ, msg string) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO deployment_events (deployment_id, type, message)
		VALUES ($1, $2, $3)
	`, deploymentID, typ, msg)
	return err
}

func (s *Store) AppendLogChunk(ctx context.Context, deploymentID, stream, chunk string) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO deployment_log_chunks (deployment_id, stream, chunk)
		VALUES ($1, $2, $3)
	`, deploymentID, stream, chunk)
	return err
}

func (s *Store) ListLogChunks(ctx context.Context, deploymentID string, afterID int64, limit int) ([]DeploymentLogChunk, error) {
	if limit <= 0 || limit > 2000 {
		limit = 500
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, deployment_id, ts, stream, chunk
		FROM deployment_log_chunks
		WHERE deployment_id = $1 AND id > $2
		ORDER BY id ASC
		LIMIT $3
	`, deploymentID, afterID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DeploymentLogChunk
	for rows.Next() {
		var c DeploymentLogChunk
		if err := rows.Scan(&c.ID, &c.DeploymentID, &c.TS, &c.Stream, &c.Chunk); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) GetDeployment(ctx context.Context, id string) (*Deployment, error) {
	var d Deployment
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, project_id, git_sha, git_ref, type, status, image_ref, container_name, service_port, preview_url, created_at, updated_at, promoted_at
		FROM deployments
		WHERE id = $1
	`, id).Scan(
		&d.ID, &d.ProjectID, &d.GitSHA, &d.GitRef, &d.Type, &d.Status,
		&d.ImageRef, &d.ContainerName, &d.ServicePort, &d.PreviewURL, &d.CreatedAt, &d.UpdatedAt, &d.PromotedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (s *Store) ListDeploymentsByProject(ctx context.Context, projectID string, limit int) ([]Deployment, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, project_id, git_sha, git_ref, type, status, image_ref, container_name, service_port, preview_url, created_at, updated_at, promoted_at
		FROM deployments
		WHERE project_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, projectID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Deployment
	for rows.Next() {
		var d Deployment
		if err := rows.Scan(&d.ID, &d.ProjectID, &d.GitSHA, &d.GitRef, &d.Type, &d.Status, &d.ImageRef, &d.ContainerName, &d.ServicePort, &d.PreviewURL, &d.CreatedAt, &d.UpdatedAt, &d.PromotedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) SetProjectProductionDeployment(ctx context.Context, projectID, deploymentID string) error {
	_, err := s.DB.ExecContext(ctx, `
		UPDATE projects
		SET production_deployment_id = $2
		WHERE id = $1
	`, projectID, deploymentID)
	return err
}

func (s *Store) UpdateProjectGitHubInfo(ctx context.Context, projectID string, installationID int64, defaultBranch string) error {
	_, err := s.DB.ExecContext(ctx, `
		UPDATE projects
		SET github_installation_id = $2,
		    github_default_branch = $3
		WHERE id = $1
	`, projectID, installationID, defaultBranch)
	return err
}

func (s *Store) UpsertEnvVar(ctx context.Context, projectID, scope, key string, valueEnc []byte) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO project_env_vars (project_id, scope, key, value_enc)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (project_id, scope, key)
		DO UPDATE SET value_enc = EXCLUDED.value_enc
	`, projectID, scope, key, valueEnc)
	return err
}

func (s *Store) ListEnvVars(ctx context.Context, projectID string, scope string) ([]EnvVar, error) {
	var rows *sql.Rows
	var err error
	if scope == "" {
		rows, err = s.DB.QueryContext(ctx, `
			SELECT id, project_id, scope, key, value_enc, created_at
			FROM project_env_vars
			WHERE project_id = $1
			ORDER BY scope ASC, key ASC
		`, projectID)
	} else {
		rows, err = s.DB.QueryContext(ctx, `
			SELECT id, project_id, scope, key, value_enc, created_at
			FROM project_env_vars
			WHERE project_id = $1 AND scope = $2
			ORDER BY key ASC
		`, projectID, scope)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []EnvVar
	for rows.Next() {
		var v EnvVar
		if err := rows.Scan(&v.ID, &v.ProjectID, &v.Scope, &v.Key, &v.ValueEnc, &v.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

func nullString(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func nullStringPtr(p *string) any {
	if p == nil {
		return nil
	}
	if *p == "" {
		return nil
	}
	return *p
}

func nullIntPtr(p *int) any {
	if p == nil {
		return nil
	}
	return *p
}
