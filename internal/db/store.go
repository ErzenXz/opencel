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
	ID              string
	Email           string
	PasswordHash    string
	IsInstanceAdmin bool
	CreatedAt       time.Time
}

type Organization struct {
	ID        string
	Slug      string
	Name      string
	CreatedAt time.Time
}

type OrgMembership struct {
	OrgID     string
	UserID    string
	Role      string
	CreatedAt time.Time
}

type Project struct {
	ID                     string
	OrgID                  string
	Slug                   string
	RepoFullName           string
	GitHubInstallationID   sql.NullInt64
	GitHubDefaultBranch    sql.NullString
	ProductionDeploymentID sql.NullString
	CreatedAt              time.Time
}

type ProjectSettings struct {
	ProjectID    string
	SettingsJSON []byte
	UpdatedAt    time.Time
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
		RETURNING id, email, password_hash, is_instance_admin, created_at
	`, email, passwordHash).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.IsInstanceAdmin, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, email, password_hash, is_instance_admin, created_at
		FROM users
		WHERE email = $1
	`, email).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.IsInstanceAdmin, &u.CreatedAt)
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
		SELECT id, email, password_hash, is_instance_admin, created_at
		FROM users
		WHERE id = $1
	`, id).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.IsInstanceAdmin, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) SetInstanceAdmin(ctx context.Context, userID string, admin bool) error {
	_, err := s.DB.ExecContext(ctx, `
		UPDATE users
		SET is_instance_admin = $2
		WHERE id = $1
	`, userID, admin)
	return err
}

func (s *Store) CreateOrganization(ctx context.Context, slug, name string) (*Organization, error) {
	var o Organization
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO organizations (slug, name)
		VALUES ($1, $2)
		RETURNING id, slug, name, created_at
	`, slug, name).Scan(&o.ID, &o.Slug, &o.Name, &o.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (s *Store) GetOrganization(ctx context.Context, id string) (*Organization, error) {
	var o Organization
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, slug, name, created_at
		FROM organizations
		WHERE id = $1
	`, id).Scan(&o.ID, &o.Slug, &o.Name, &o.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (s *Store) ListOrganizationsByUser(ctx context.Context, userID string) ([]Organization, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT o.id, o.slug, o.name, o.created_at
		FROM organizations o
		JOIN organization_memberships m ON m.org_id = o.id
		WHERE m.user_id = $1
		ORDER BY o.created_at ASC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Organization
	for rows.Next() {
		var o Organization
		if err := rows.Scan(&o.ID, &o.Slug, &o.Name, &o.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

func (s *Store) AddOrgMember(ctx context.Context, orgID, userID, role string) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO organization_memberships (org_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role
	`, orgID, userID, role)
	return err
}

func (s *Store) RemoveOrgMember(ctx context.Context, orgID, userID string) error {
	_, err := s.DB.ExecContext(ctx, `
		DELETE FROM organization_memberships
		WHERE org_id = $1 AND user_id = $2
	`, orgID, userID)
	return err
}

func (s *Store) GetOrgMembership(ctx context.Context, orgID, userID string) (*OrgMembership, error) {
	var m OrgMembership
	err := s.DB.QueryRowContext(ctx, `
		SELECT org_id, user_id, role, created_at
		FROM organization_memberships
		WHERE org_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&m.OrgID, &m.UserID, &m.Role, &m.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &m, nil
}

type OrgMemberRow struct {
	UserID    string
	Email     string
	Role      string
	CreatedAt time.Time
}

func (s *Store) ListOrgMembers(ctx context.Context, orgID string) ([]OrgMemberRow, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT u.id, u.email, m.role, m.created_at
		FROM organization_memberships m
		JOIN users u ON u.id = m.user_id
		WHERE m.org_id = $1
		ORDER BY m.created_at ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []OrgMemberRow
	for rows.Next() {
		var r OrgMemberRow
		if err := rows.Scan(&r.UserID, &r.Email, &r.Role, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) FirstOrganization(ctx context.Context) (*Organization, error) {
	var o Organization
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, slug, name, created_at
		FROM organizations
		ORDER BY created_at ASC
		LIMIT 1
	`).Scan(&o.ID, &o.Slug, &o.Name, &o.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func (s *Store) CreateProject(ctx context.Context, orgID, slug, repoFullName string, installationID *int64, defaultBranch *string) (*Project, error) {
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
		INSERT INTO projects (org_id, slug, repo_full_name, github_installation_id, github_default_branch)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, org_id, slug, repo_full_name, github_installation_id, github_default_branch, production_deployment_id, created_at
	`, orgID, slug, repoFullName, inst, def).Scan(
		&p.ID, &p.OrgID, &p.Slug, &p.RepoFullName, &p.GitHubInstallationID, &p.GitHubDefaultBranch, &p.ProductionDeploymentID, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Store) ListProjectsByOrg(ctx context.Context, orgID string) ([]Project, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, org_id, slug, repo_full_name, github_installation_id, github_default_branch, production_deployment_id, created_at
		FROM projects
		WHERE org_id = $1
		ORDER BY created_at DESC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.OrgID, &p.Slug, &p.RepoFullName, &p.GitHubInstallationID, &p.GitHubDefaultBranch, &p.ProductionDeploymentID, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) ListProjects(ctx context.Context) ([]Project, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, org_id, slug, repo_full_name, github_installation_id, github_default_branch, production_deployment_id, created_at
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
		if err := rows.Scan(&p.ID, &p.OrgID, &p.Slug, &p.RepoFullName, &p.GitHubInstallationID, &p.GitHubDefaultBranch, &p.ProductionDeploymentID, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) GetProject(ctx context.Context, id string) (*Project, error) {
	var p Project
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, org_id, slug, repo_full_name, github_installation_id, github_default_branch, production_deployment_id, created_at
		FROM projects
		WHERE id = $1
	`, id).Scan(&p.ID, &p.OrgID, &p.Slug, &p.RepoFullName, &p.GitHubInstallationID, &p.GitHubDefaultBranch, &p.ProductionDeploymentID, &p.CreatedAt)
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
		SELECT id, org_id, slug, repo_full_name, github_installation_id, github_default_branch, production_deployment_id, created_at
		FROM projects
		WHERE repo_full_name = $1
	`, repoFullName).Scan(&p.ID, &p.OrgID, &p.Slug, &p.RepoFullName, &p.GitHubInstallationID, &p.GitHubDefaultBranch, &p.ProductionDeploymentID, &p.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Store) IsUserOrgMember(ctx context.Context, userID, orgID string) (bool, error) {
	var n int
	if err := s.DB.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM organization_memberships
		WHERE org_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&n); err != nil {
		return false, err
	}
	return n > 0, nil
}

func (s *Store) GetOrgRole(ctx context.Context, userID, orgID string) (string, error) {
	var role string
	err := s.DB.QueryRowContext(ctx, `
		SELECT role
		FROM organization_memberships
		WHERE org_id = $1 AND user_id = $2
	`, orgID, userID).Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return role, nil
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

func (s *Store) UpsertProjectSettingsJSON(ctx context.Context, projectID string, settingsJSON []byte) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO project_settings (project_id, settings_json, updated_at)
		VALUES ($1, $2, now())
		ON CONFLICT (project_id) DO UPDATE
		SET settings_json = EXCLUDED.settings_json,
		    updated_at = now()
	`, projectID, settingsJSON)
	return err
}

func (s *Store) GetProjectSettingsJSON(ctx context.Context, projectID string) ([]byte, error) {
	var b []byte
	err := s.DB.QueryRowContext(ctx, `
		SELECT settings_json
		FROM project_settings
		WHERE project_id = $1
	`, projectID).Scan(&b)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return b, err
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

// ---- GitHub OAuth + identities ----

type UserIdentity struct {
	ID             string
	UserID         string
	Provider       string
	ProviderUserID string
	ProviderLogin  string
	CreatedAt      time.Time
}

func (s *Store) UpsertUserIdentity(ctx context.Context, userID, provider, providerUserID, providerLogin string) (*UserIdentity, error) {
	var out UserIdentity
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO user_identities (user_id, provider, provider_user_id, provider_login)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (provider, provider_user_id) DO UPDATE
		SET user_id = EXCLUDED.user_id,
		    provider_login = EXCLUDED.provider_login
		RETURNING id, user_id, provider, provider_user_id, provider_login, created_at
	`, userID, provider, providerUserID, providerLogin).Scan(&out.ID, &out.UserID, &out.Provider, &out.ProviderUserID, &out.ProviderLogin, &out.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) GetUserIdentity(ctx context.Context, provider, providerUserID string) (*UserIdentity, error) {
	var out UserIdentity
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, user_id, provider, provider_user_id, provider_login, created_at
		FROM user_identities
		WHERE provider = $1 AND provider_user_id = $2
	`, provider, providerUserID).Scan(&out.ID, &out.UserID, &out.Provider, &out.ProviderUserID, &out.ProviderLogin, &out.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

type GitHubOAuthToken struct {
	UserID         string
	AccessTokenEnc []byte
	Scopes         string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

func (s *Store) UpsertGitHubOAuthToken(ctx context.Context, userID string, accessTokenEnc []byte, scopes string) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO github_oauth_tokens (user_id, access_token_enc, scopes, created_at, updated_at)
		VALUES ($1, $2, $3, now(), now())
		ON CONFLICT (user_id) DO UPDATE
		SET access_token_enc = EXCLUDED.access_token_enc,
		    scopes = EXCLUDED.scopes,
		    updated_at = now()
	`, userID, accessTokenEnc, scopes)
	return err
}

func (s *Store) GetGitHubOAuthToken(ctx context.Context, userID string) (*GitHubOAuthToken, error) {
	var t GitHubOAuthToken
	err := s.DB.QueryRowContext(ctx, `
		SELECT user_id, access_token_enc, scopes, created_at, updated_at
		FROM github_oauth_tokens
		WHERE user_id = $1
	`, userID).Scan(&t.UserID, &t.AccessTokenEnc, &t.Scopes, &t.CreatedAt, &t.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *Store) DeleteGitHubOAuthToken(ctx context.Context, userID string) error {
	_, err := s.DB.ExecContext(ctx, `DELETE FROM github_oauth_tokens WHERE user_id = $1`, userID)
	return err
}

// ---- Admin jobs (agent) ----

type AdminJob struct {
	ID              string
	Type            string
	Status          string
	CreatedByUserID sql.NullString
	CreatedAt       time.Time
	StartedAt       sql.NullTime
	FinishedAt      sql.NullTime
	Error           sql.NullString
}

func (s *Store) CreateAdminJob(ctx context.Context, typ string, createdByUserID *string) (*AdminJob, error) {
	var j AdminJob
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO admin_jobs (type, status, created_by_user_id)
		VALUES ($1, 'queued', $2)
		RETURNING id, type, status, created_by_user_id, created_at, started_at, finished_at, error
	`, typ, nullStringPtr(createdByUserID)).Scan(&j.ID, &j.Type, &j.Status, &j.CreatedByUserID, &j.CreatedAt, &j.StartedAt, &j.FinishedAt, &j.Error)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

func (s *Store) SetAdminJobStatus(ctx context.Context, jobID, status string, errMsg *string) error {
	switch status {
	case "running":
		_, err := s.DB.ExecContext(ctx, `
			UPDATE admin_jobs
			SET status = $2, started_at = COALESCE(started_at, now()), error = $3
			WHERE id = $1
		`, jobID, status, nullStringPtr(errMsg))
		return err
	case "success", "failed":
		_, err := s.DB.ExecContext(ctx, `
			UPDATE admin_jobs
			SET status = $2, finished_at = now(), error = $3
			WHERE id = $1
		`, jobID, status, nullStringPtr(errMsg))
		return err
	default:
		_, err := s.DB.ExecContext(ctx, `
			UPDATE admin_jobs
			SET status = $2, error = $3
			WHERE id = $1
		`, jobID, status, nullStringPtr(errMsg))
		return err
	}
}

func (s *Store) AppendAdminJobLog(ctx context.Context, jobID, stream, chunk string) error {
	if stream == "" {
		stream = "system"
	}
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO admin_job_logs (job_id, stream, chunk)
		VALUES ($1, $2, $3)
	`, jobID, stream, chunk)
	return err
}

type AdminJobLog struct {
	ID     int64
	JobID  string
	TS     time.Time
	Stream string
	Chunk  string
}

func (s *Store) GetAdminJob(ctx context.Context, jobID string) (*AdminJob, error) {
	var j AdminJob
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, type, status, created_by_user_id, created_at, started_at, finished_at, error
		FROM admin_jobs
		WHERE id = $1
	`, jobID).Scan(&j.ID, &j.Type, &j.Status, &j.CreatedByUserID, &j.CreatedAt, &j.StartedAt, &j.FinishedAt, &j.Error)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &j, nil
}

func (s *Store) ListAdminJobLogs(ctx context.Context, jobID string, limit int) ([]AdminJobLog, error) {
	if limit <= 0 || limit > 2000 {
		limit = 500
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, job_id, ts, stream, chunk
		FROM admin_job_logs
		WHERE job_id = $1
		ORDER BY id ASC
		LIMIT $2
	`, jobID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AdminJobLog
	for rows.Next() {
		var l AdminJobLog
		if err := rows.Scan(&l.ID, &l.JobID, &l.TS, &l.Stream, &l.Chunk); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}
