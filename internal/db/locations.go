package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

type Location struct {
	ID        string
	OrgID     string
	Slug      string
	Name      string
	Region    sql.NullString
	Country   sql.NullString
	CreatedAt time.Time
}

type Node struct {
	ID              string
	OrgID           string
	LocationID      sql.NullString
	Name            string
	Role            string
	Status          string
	AgentURL        sql.NullString
	TokenPrefix     sql.NullString
	TokenHash       string
	TokenEnc        []byte
	Hostname        sql.NullString
	AgentVersion    sql.NullString
	CPUCores        sql.NullInt64
	MemoryBytes     sql.NullInt64
	LastSeenAt      sql.NullTime
	LastMetricsJSON []byte
	CreatedAt       time.Time
}

type Service struct {
	ID            string
	OrgID         string
	LocationID    sql.NullString
	NodeID        sql.NullString
	Name          string
	Kind          string
	Version       string
	Status        string
	ContainerName sql.NullString
	InternalHost  sql.NullString
	InternalPort  sql.NullInt64
	Username      sql.NullString
	DatabaseName  sql.NullString
	PasswordEnc   []byte
	ConfigJSON    []byte
	ErrorMessage  sql.NullString
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// ── Locations ────────────────────────────────────────────────────────────────

func (s *Store) CreateLocation(ctx context.Context, orgID, slug, name, region, country string) (*Location, error) {
	var l Location
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO locations (org_id, slug, name, region, country)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''))
		RETURNING id, org_id, slug, name, region, country, created_at
	`, orgID, slug, name, region, country).Scan(
		&l.ID, &l.OrgID, &l.Slug, &l.Name, &l.Region, &l.Country, &l.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (s *Store) ListLocationsByOrg(ctx context.Context, orgID string) ([]Location, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, org_id, slug, name, region, country, created_at
		FROM locations
		WHERE org_id = $1
		ORDER BY created_at ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Location
	for rows.Next() {
		var l Location
		if err := rows.Scan(&l.ID, &l.OrgID, &l.Slug, &l.Name, &l.Region, &l.Country, &l.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (s *Store) GetLocation(ctx context.Context, id string) (*Location, error) {
	var l Location
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, org_id, slug, name, region, country, created_at
		FROM locations
		WHERE id = $1
	`, id).Scan(&l.ID, &l.OrgID, &l.Slug, &l.Name, &l.Region, &l.Country, &l.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func (s *Store) DeleteLocation(ctx context.Context, id string) error {
	_, err := s.DB.ExecContext(ctx, `DELETE FROM locations WHERE id = $1`, id)
	return err
}

// ── Nodes ────────────────────────────────────────────────────────────────────

type CreateNodeParams struct {
	OrgID       string
	LocationID  string
	Name        string
	Role        string
	TokenPrefix string
	TokenHash   string
	TokenEnc    []byte
}

func (s *Store) CreateNode(ctx context.Context, p CreateNodeParams) (*Node, error) {
	var locID sql.NullString
	if p.LocationID != "" {
		locID = sql.NullString{String: p.LocationID, Valid: true}
	}
	var n Node
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO nodes (org_id, location_id, name, role, token_prefix, token_hash, token_enc)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, org_id, location_id, name, role, status, agent_url, token_prefix, token_hash, token_enc,
		          hostname, agent_version, cpu_cores, memory_bytes, last_seen_at, last_metrics_json, created_at
	`, p.OrgID, locID, p.Name, p.Role, p.TokenPrefix, p.TokenHash, p.TokenEnc).Scan(
		&n.ID, &n.OrgID, &n.LocationID, &n.Name, &n.Role, &n.Status, &n.AgentURL, &n.TokenPrefix, &n.TokenHash, &n.TokenEnc,
		&n.Hostname, &n.AgentVersion, &n.CPUCores, &n.MemoryBytes, &n.LastSeenAt, &n.LastMetricsJSON, &n.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (s *Store) ListNodesByOrg(ctx context.Context, orgID string) ([]Node, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, org_id, location_id, name, role, status, agent_url, token_prefix, token_hash, token_enc,
		       hostname, agent_version, cpu_cores, memory_bytes, last_seen_at, last_metrics_json, created_at
		FROM nodes
		WHERE org_id = $1
		ORDER BY created_at ASC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Node
	for rows.Next() {
		var n Node
		if err := rows.Scan(&n.ID, &n.OrgID, &n.LocationID, &n.Name, &n.Role, &n.Status, &n.AgentURL, &n.TokenPrefix, &n.TokenHash, &n.TokenEnc,
			&n.Hostname, &n.AgentVersion, &n.CPUCores, &n.MemoryBytes, &n.LastSeenAt, &n.LastMetricsJSON, &n.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (s *Store) ListNodesByLocation(ctx context.Context, locationID string) ([]Node, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, org_id, location_id, name, role, status, agent_url, token_prefix, token_hash, token_enc,
		       hostname, agent_version, cpu_cores, memory_bytes, last_seen_at, last_metrics_json, created_at
		FROM nodes
		WHERE location_id = $1
		ORDER BY created_at ASC
	`, locationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Node
	for rows.Next() {
		var n Node
		if err := rows.Scan(&n.ID, &n.OrgID, &n.LocationID, &n.Name, &n.Role, &n.Status, &n.AgentURL, &n.TokenPrefix, &n.TokenHash, &n.TokenEnc,
			&n.Hostname, &n.AgentVersion, &n.CPUCores, &n.MemoryBytes, &n.LastSeenAt, &n.LastMetricsJSON, &n.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (s *Store) GetNode(ctx context.Context, id string) (*Node, error) {
	var n Node
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, org_id, location_id, name, role, status, agent_url, token_prefix, token_hash, token_enc,
		       hostname, agent_version, cpu_cores, memory_bytes, last_seen_at, last_metrics_json, created_at
		FROM nodes WHERE id = $1
	`, id).Scan(&n.ID, &n.OrgID, &n.LocationID, &n.Name, &n.Role, &n.Status, &n.AgentURL, &n.TokenPrefix, &n.TokenHash, &n.TokenEnc,
		&n.Hostname, &n.AgentVersion, &n.CPUCores, &n.MemoryBytes, &n.LastSeenAt, &n.LastMetricsJSON, &n.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (s *Store) GetNodeByTokenHash(ctx context.Context, tokenHash string) (*Node, error) {
	var n Node
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, org_id, location_id, name, role, status, agent_url, token_prefix, token_hash, token_enc,
		       hostname, agent_version, cpu_cores, memory_bytes, last_seen_at, last_metrics_json, created_at
		FROM nodes WHERE token_hash = $1
	`, tokenHash).Scan(&n.ID, &n.OrgID, &n.LocationID, &n.Name, &n.Role, &n.Status, &n.AgentURL, &n.TokenPrefix, &n.TokenHash, &n.TokenEnc,
		&n.Hostname, &n.AgentVersion, &n.CPUCores, &n.MemoryBytes, &n.LastSeenAt, &n.LastMetricsJSON, &n.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &n, nil
}

type NodeHeartbeatParams struct {
	AgentURL     string
	Hostname     string
	AgentVersion string
	CPUCores     int
	MemoryBytes  int64
	MetricsJSON  []byte
}

func (s *Store) UpdateNodeHeartbeat(ctx context.Context, id string, p NodeHeartbeatParams) error {
	if p.MetricsJSON == nil {
		p.MetricsJSON = []byte("{}")
	}
	_, err := s.DB.ExecContext(ctx, `
		UPDATE nodes
		SET status = 'online',
		    agent_url = COALESCE(NULLIF($2, ''), agent_url),
		    hostname = COALESCE(NULLIF($3, ''), hostname),
		    agent_version = COALESCE(NULLIF($4, ''), agent_version),
		    cpu_cores = CASE WHEN $5::int > 0 THEN $5 ELSE cpu_cores END,
		    memory_bytes = CASE WHEN $6::bigint > 0 THEN $6 ELSE memory_bytes END,
		    last_seen_at = now(),
		    last_metrics_json = $7::jsonb
		WHERE id = $1
	`, id, p.AgentURL, p.Hostname, p.AgentVersion, p.CPUCores, p.MemoryBytes, string(p.MetricsJSON))
	return err
}

func (s *Store) DeleteNode(ctx context.Context, id string) error {
	_, err := s.DB.ExecContext(ctx, `DELETE FROM nodes WHERE id = $1`, id)
	return err
}

func (s *Store) MarkStaleNodesOffline(ctx context.Context, olderThan time.Duration) error {
	// Postgres ::interval can't parse Go's duration format (e.g. "2m0s"); format
	// as seconds so any duration serializes to a valid interval literal.
	interval := fmt.Sprintf("%d seconds", int(olderThan.Seconds()))
	_, err := s.DB.ExecContext(ctx, `
		UPDATE nodes
		SET status = 'offline'
		WHERE status = 'online' AND (last_seen_at IS NULL OR last_seen_at < now() - $1::interval)
	`, interval)
	return err
}

// ── Services ─────────────────────────────────────────────────────────────────

type CreateServiceParams struct {
	OrgID        string
	LocationID   string
	NodeID       string
	Name         string
	Kind         string
	Version      string
	Username     string
	DatabaseName string
	PasswordEnc  []byte
	ConfigJSON   []byte
}

func (s *Store) CreateService(ctx context.Context, p CreateServiceParams) (*Service, error) {
	var locID, nodeID sql.NullString
	if p.LocationID != "" {
		locID = sql.NullString{String: p.LocationID, Valid: true}
	}
	if p.NodeID != "" {
		nodeID = sql.NullString{String: p.NodeID, Valid: true}
	}
	if p.Version == "" {
		p.Version = "latest"
	}
	if p.ConfigJSON == nil {
		p.ConfigJSON = []byte("{}")
	}
	var sv Service
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO services (org_id, location_id, node_id, name, kind, version, username, database_name, password_enc, config_json)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), NULLIF($8, ''), $9, $10)
		RETURNING id, org_id, location_id, node_id, name, kind, version, status, container_name, internal_host, internal_port,
		          username, database_name, password_enc, config_json, error_message, created_at, updated_at
	`, p.OrgID, locID, nodeID, p.Name, p.Kind, p.Version, p.Username, p.DatabaseName, p.PasswordEnc, string(p.ConfigJSON)).Scan(
		&sv.ID, &sv.OrgID, &sv.LocationID, &sv.NodeID, &sv.Name, &sv.Kind, &sv.Version, &sv.Status,
		&sv.ContainerName, &sv.InternalHost, &sv.InternalPort, &sv.Username, &sv.DatabaseName,
		&sv.PasswordEnc, &sv.ConfigJSON, &sv.ErrorMessage, &sv.CreatedAt, &sv.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &sv, nil
}

func (s *Store) ListServicesByOrg(ctx context.Context, orgID string) ([]Service, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, org_id, location_id, node_id, name, kind, version, status, container_name, internal_host, internal_port,
		       username, database_name, password_enc, config_json, error_message, created_at, updated_at
		FROM services
		WHERE org_id = $1
		ORDER BY created_at DESC
	`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Service
	for rows.Next() {
		var sv Service
		if err := rows.Scan(&sv.ID, &sv.OrgID, &sv.LocationID, &sv.NodeID, &sv.Name, &sv.Kind, &sv.Version, &sv.Status,
			&sv.ContainerName, &sv.InternalHost, &sv.InternalPort, &sv.Username, &sv.DatabaseName,
			&sv.PasswordEnc, &sv.ConfigJSON, &sv.ErrorMessage, &sv.CreatedAt, &sv.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, sv)
	}
	return out, rows.Err()
}

func (s *Store) GetService(ctx context.Context, id string) (*Service, error) {
	var sv Service
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, org_id, location_id, node_id, name, kind, version, status, container_name, internal_host, internal_port,
		       username, database_name, password_enc, config_json, error_message, created_at, updated_at
		FROM services WHERE id = $1
	`, id).Scan(&sv.ID, &sv.OrgID, &sv.LocationID, &sv.NodeID, &sv.Name, &sv.Kind, &sv.Version, &sv.Status,
		&sv.ContainerName, &sv.InternalHost, &sv.InternalPort, &sv.Username, &sv.DatabaseName,
		&sv.PasswordEnc, &sv.ConfigJSON, &sv.ErrorMessage, &sv.CreatedAt, &sv.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &sv, nil
}

type ServiceRunningInfo struct {
	ContainerName string
	InternalHost  string
	InternalPort  int
}

func (s *Store) UpdateServiceRunning(ctx context.Context, id string, info ServiceRunningInfo) error {
	_, err := s.DB.ExecContext(ctx, `
		UPDATE services
		SET status = 'running',
		    container_name = $2,
		    internal_host = $3,
		    internal_port = $4,
		    error_message = NULL,
		    updated_at = now()
		WHERE id = $1
	`, id, info.ContainerName, info.InternalHost, info.InternalPort)
	return err
}

func (s *Store) UpdateServiceStatus(ctx context.Context, id, status, errorMsg string) error {
	var em sql.NullString
	if errorMsg != "" {
		em = sql.NullString{String: errorMsg, Valid: true}
	}
	_, err := s.DB.ExecContext(ctx, `
		UPDATE services
		SET status = $2,
		    error_message = $3,
		    updated_at = now()
		WHERE id = $1
	`, id, status, em)
	return err
}

func (s *Store) DeleteService(ctx context.Context, id string) error {
	_, err := s.DB.ExecContext(ctx, `DELETE FROM services WHERE id = $1`, id)
	return err
}
