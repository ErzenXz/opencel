package api

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/opencel/opencel/internal/db"
)

type locationResp struct {
	ID        string    `json:"id"`
	OrgID     string    `json:"org_id"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
	Region    string    `json:"region,omitempty"`
	Country   string    `json:"country,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	NodeCount int       `json:"node_count"`
}

func toLocationResp(l db.Location, nodeCount int) locationResp {
	return locationResp{
		ID:        l.ID,
		OrgID:     l.OrgID,
		Slug:      l.Slug,
		Name:      l.Name,
		Region:    l.Region.String,
		Country:   l.Country.String,
		CreatedAt: l.CreatedAt,
		NodeCount: nodeCount,
	}
}

var locationSlugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,62}$`)

func slugifyLocation(in string) string {
	s := strings.ToLower(strings.TrimSpace(in))
	var b strings.Builder
	lastDash := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastDash = false
		case r == ' ', r == '-', r == '_', r == '/':
			if !lastDash && b.Len() > 0 {
				b.WriteRune('-')
				lastDash = true
			}
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) > 63 {
		out = out[:63]
	}
	return out
}

func (s *Server) handleListLocations(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if herr := s.requireOrgRole(r.Context(), uid, orgID, "member"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	locs, err := s.Store.ListLocationsByOrg(r.Context(), orgID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	out := make([]locationResp, 0, len(locs))
	for _, l := range locs {
		nodes, _ := s.Store.ListNodesByLocation(r.Context(), l.ID)
		out = append(out, toLocationResp(l, len(nodes)))
	}
	writeJSON(w, 200, out)
}

type createLocationReq struct {
	Slug    string `json:"slug"`
	Name    string `json:"name"`
	Region  string `json:"region"`
	Country string `json:"country"`
}

func (s *Server) handleCreateLocation(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if herr := s.requireOrgRole(r.Context(), uid, orgID, "admin"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	var req createLocationReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeJSON(w, 400, map[string]any{"error": "name required"})
		return
	}
	slug := strings.TrimSpace(strings.ToLower(req.Slug))
	if slug == "" {
		slug = slugifyLocation(name)
	}
	if !locationSlugRe.MatchString(slug) {
		writeJSON(w, 400, map[string]any{"error": "invalid slug"})
		return
	}
	l, err := s.Store.CreateLocation(r.Context(), orgID, slug, name, strings.TrimSpace(req.Region), strings.TrimSpace(req.Country))
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 201, toLocationResp(*l, 0))
}

func (s *Server) handleGetLocation(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	id := chiURLParam(r, "id")
	l, err := s.Store.GetLocation(r.Context(), id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if l == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	if herr := s.requireOrgRole(r.Context(), uid, l.OrgID, "member"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	nodes, _ := s.Store.ListNodesByLocation(r.Context(), l.ID)
	writeJSON(w, 200, toLocationResp(*l, len(nodes)))
}

func (s *Server) handleDeleteLocation(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	id := chiURLParam(r, "id")
	l, err := s.Store.GetLocation(r.Context(), id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if l == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	if herr := s.requireOrgRole(r.Context(), uid, l.OrgID, "admin"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	if err := s.Store.DeleteLocation(r.Context(), id); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

// ── Nodes ────────────────────────────────────────────────────────────────────

type nodeResp struct {
	ID           string            `json:"id"`
	OrgID        string            `json:"org_id"`
	LocationID   string            `json:"location_id,omitempty"`
	Name         string            `json:"name"`
	Role         string            `json:"role"`
	Status       string            `json:"status"`
	AgentURL     string            `json:"agent_url,omitempty"`
	Hostname     string            `json:"hostname,omitempty"`
	AgentVersion string            `json:"agent_version,omitempty"`
	CPUCores     int               `json:"cpu_cores,omitempty"`
	MemoryBytes  int64             `json:"memory_bytes,omitempty"`
	TokenPrefix  string            `json:"token_prefix,omitempty"`
	LastSeenAt   *time.Time        `json:"last_seen_at,omitempty"`
	Metrics      map[string]any    `json:"metrics,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
}

func toNodeResp(n db.Node) nodeResp {
	var last *time.Time
	if n.LastSeenAt.Valid {
		t := n.LastSeenAt.Time
		last = &t
	}
	var metrics map[string]any
	if len(n.LastMetricsJSON) > 0 {
		_ = json.Unmarshal(n.LastMetricsJSON, &metrics)
	}
	return nodeResp{
		ID:           n.ID,
		OrgID:        n.OrgID,
		LocationID:   n.LocationID.String,
		Name:         n.Name,
		Role:         n.Role,
		Status:       n.Status,
		AgentURL:     n.AgentURL.String,
		Hostname:     n.Hostname.String,
		AgentVersion: n.AgentVersion.String,
		CPUCores:     int(n.CPUCores.Int64),
		MemoryBytes:  n.MemoryBytes.Int64,
		TokenPrefix:  n.TokenPrefix.String,
		LastSeenAt:   last,
		Metrics:      metrics,
		CreatedAt:    n.CreatedAt,
	}
}

func (s *Server) handleListNodes(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if herr := s.requireOrgRole(r.Context(), uid, orgID, "member"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	ns, err := s.Store.ListNodesByOrg(r.Context(), orgID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	out := make([]nodeResp, 0, len(ns))
	for _, n := range ns {
		out = append(out, toNodeResp(n))
	}
	writeJSON(w, 200, out)
}

type createNodeReq struct {
	LocationID string `json:"location_id"`
	Name       string `json:"name"`
}

type createNodeResp struct {
	Node  nodeResp `json:"node"`
	Token string   `json:"token"`
}

func generateToken() (string, string, string, error) {
	var b [24]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", "", "", err
	}
	tok := hex.EncodeToString(b[:])
	sum := sha256.Sum256([]byte(tok))
	hash := hex.EncodeToString(sum[:])
	prefix := tok[:8]
	return tok, hash, prefix, nil
}

func (s *Server) handleCreateNode(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if herr := s.requireOrgRole(r.Context(), uid, orgID, "admin"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	var req createNodeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeJSON(w, 400, map[string]any{"error": "name required"})
		return
	}
	// Sanity-check location belongs to the org, if supplied.
	if strings.TrimSpace(req.LocationID) != "" {
		l, err := s.Store.GetLocation(r.Context(), req.LocationID)
		if err != nil {
			writeJSON(w, 500, map[string]any{"error": err.Error()})
			return
		}
		if l == nil || l.OrgID != orgID {
			writeJSON(w, 400, map[string]any{"error": "invalid location"})
			return
		}
	}
	tok, hash, prefix, err := generateToken()
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	n, err := s.Store.CreateNode(r.Context(), db.CreateNodeParams{
		OrgID:       orgID,
		LocationID:  strings.TrimSpace(req.LocationID),
		Name:        name,
		Role:        "worker",
		TokenPrefix: prefix,
		TokenHash:   hash,
	})
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 201, createNodeResp{Node: toNodeResp(*n), Token: tok})
}

func (s *Server) handleDeleteNode(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	id := chiURLParam(r, "id")
	n, err := s.Store.GetNode(r.Context(), id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if n == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	if herr := s.requireOrgRole(r.Context(), uid, n.OrgID, "admin"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	if err := s.Store.DeleteNode(r.Context(), id); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

// ── Agent endpoints (token auth) ─────────────────────────────────────────────

type heartbeatReq struct {
	AgentURL     string         `json:"agent_url"`
	Hostname     string         `json:"hostname"`
	AgentVersion string         `json:"agent_version"`
	CPUCores     int            `json:"cpu_cores"`
	MemoryBytes  int64          `json:"memory_bytes"`
	Metrics      map[string]any `json:"metrics"`
}

func (s *Server) authenticateNode(r *http.Request) (*db.Node, error) {
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return nil, fmt.Errorf("missing token")
	}
	tok := strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
	if tok == "" {
		return nil, fmt.Errorf("missing token")
	}
	sum := sha256.Sum256([]byte(tok))
	hash := hex.EncodeToString(sum[:])
	n, err := s.Store.GetNodeByTokenHash(r.Context(), hash)
	if err != nil {
		return nil, err
	}
	if n == nil {
		return nil, fmt.Errorf("invalid token")
	}
	return n, nil
}

func (s *Server) handleNodeRegister(w http.ResponseWriter, r *http.Request) {
	n, err := s.authenticateNode(r)
	if err != nil {
		writeJSON(w, 401, map[string]any{"error": "unauthorized"})
		return
	}
	var req heartbeatReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	var metrics []byte
	if req.Metrics != nil {
		metrics, _ = json.Marshal(req.Metrics)
	}
	if err := s.Store.UpdateNodeHeartbeat(r.Context(), n.ID, db.NodeHeartbeatParams{
		AgentURL:     req.AgentURL,
		Hostname:     req.Hostname,
		AgentVersion: req.AgentVersion,
		CPUCores:     req.CPUCores,
		MemoryBytes:  req.MemoryBytes,
		MetricsJSON:  metrics,
	}); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	// Reload so we can mirror any server-side defaults back.
	fresh, _ := s.Store.GetNode(r.Context(), n.ID)
	if fresh != nil {
		n = fresh
	}
	writeJSON(w, 200, map[string]any{
		"ok":          true,
		"node_id":     n.ID,
		"org_id":      n.OrgID,
		"location_id": n.LocationID.String,
	})
}

// ensure goose/sql imports referenced.
var _ = sql.ErrNoRows
