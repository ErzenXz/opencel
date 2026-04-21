package api

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/opencel/opencel/internal/crypto/envcrypt"
	"github.com/opencel/opencel/internal/db"
)

type serviceResp struct {
	ID            string    `json:"id"`
	OrgID         string    `json:"org_id"`
	LocationID    string    `json:"location_id,omitempty"`
	NodeID        string    `json:"node_id,omitempty"`
	Name          string    `json:"name"`
	Kind          string    `json:"kind"`
	Version       string    `json:"version"`
	Status        string    `json:"status"`
	ContainerName string    `json:"container_name,omitempty"`
	InternalHost  string    `json:"internal_host,omitempty"`
	InternalPort  int       `json:"internal_port,omitempty"`
	Username      string    `json:"username,omitempty"`
	DatabaseName  string    `json:"database_name,omitempty"`
	ErrorMessage  string    `json:"error_message,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func toServiceResp(sv db.Service) serviceResp {
	return serviceResp{
		ID:            sv.ID,
		OrgID:         sv.OrgID,
		LocationID:    sv.LocationID.String,
		NodeID:        sv.NodeID.String,
		Name:          sv.Name,
		Kind:          sv.Kind,
		Version:       sv.Version,
		Status:        sv.Status,
		ContainerName: sv.ContainerName.String,
		InternalHost:  sv.InternalHost.String,
		InternalPort:  int(sv.InternalPort.Int64),
		Username:      sv.Username.String,
		DatabaseName:  sv.DatabaseName.String,
		ErrorMessage:  sv.ErrorMessage.String,
		CreatedAt:     sv.CreatedAt,
		UpdatedAt:     sv.UpdatedAt,
	}
}

var supportedKinds = map[string]bool{
	"postgres": true,
	"redis":    true,
	"mysql":    true,
	"mongodb":  true,
}

func defaultVersionForKind(k string) string {
	switch k {
	case "postgres":
		return "16"
	case "redis":
		return "7"
	case "mysql":
		return "8"
	case "mongodb":
		return "7"
	default:
		return "latest"
	}
}

func defaultPortForKind(k string) int {
	switch k {
	case "postgres":
		return 5432
	case "redis":
		return 6379
	case "mysql":
		return 3306
	case "mongodb":
		return 27017
	default:
		return 0
	}
}

func (s *Server) handleListServices(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if herr := s.requireOrgRole(r.Context(), uid, orgID, "member"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	svcs, err := s.Store.ListServicesByOrg(r.Context(), orgID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	out := make([]serviceResp, 0, len(svcs))
	for _, sv := range svcs {
		out = append(out, toServiceResp(sv))
	}
	writeJSON(w, 200, out)
}

type createServiceReq struct {
	Name       string `json:"name"`
	Kind       string `json:"kind"`
	Version    string `json:"version"`
	LocationID string `json:"location_id"`
	NodeID     string `json:"node_id"`
}

func genPassword() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

func (s *Server) handleCreateService(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if herr := s.requireOrgRole(r.Context(), uid, orgID, "admin"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	var req createServiceReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	name := strings.TrimSpace(req.Name)
	kind := strings.TrimSpace(strings.ToLower(req.Kind))
	if name == "" || !supportedKinds[kind] {
		writeJSON(w, 400, map[string]any{"error": "name and valid kind required"})
		return
	}
	version := strings.TrimSpace(req.Version)
	if version == "" {
		version = defaultVersionForKind(kind)
	}
	// Location, if supplied, must belong to the requesting org. Otherwise an
	// admin in org A could attach a service to a location owned by org B.
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

	// Pick a node if not supplied: any online node, preferring the requested location.
	nodes, err := s.Store.ListNodesByOrg(r.Context(), orgID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	var chosen *db.Node
	for _, n := range nodes {
		if strings.TrimSpace(req.NodeID) != "" {
			if n.ID == req.NodeID {
				tmp := n
				chosen = &tmp
				break
			}
			continue
		}
		if strings.TrimSpace(req.LocationID) != "" && n.LocationID.String != req.LocationID {
			continue
		}
		if n.Status != "online" {
			continue
		}
		tmp := n
		chosen = &tmp
		break
	}
	// If the caller explicitly requested a node and we didn't find it in this
	// org, that's a bad request — don't silently place the service elsewhere.
	if chosen == nil && strings.TrimSpace(req.NodeID) != "" {
		writeJSON(w, 400, map[string]any{"error": "node_id not found in this org"})
		return
	}
	// Fall back to any online node if none matched; fall back to the primary.
	if chosen == nil {
		for _, n := range nodes {
			if n.Status == "online" {
				tmp := n
				chosen = &tmp
				break
			}
		}
	}
	if chosen == nil {
		for _, n := range nodes {
			if n.Role == "primary" {
				tmp := n
				chosen = &tmp
				break
			}
		}
	}

	pw, err := genPassword()
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	pwEnc, err := envcrypt.Encrypt(s.Cfg.EncryptKey, []byte(pw))
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}

	username := "opencel"
	dbName := ""
	if kind == "postgres" || kind == "mysql" || kind == "mongodb" {
		dbName = "opencel"
	}

	params := db.CreateServiceParams{
		OrgID:        orgID,
		LocationID:   strings.TrimSpace(req.LocationID),
		Name:         name,
		Kind:         kind,
		Version:      version,
		Username:     username,
		DatabaseName: dbName,
		PasswordEnc:  pwEnc,
	}
	if chosen != nil {
		params.NodeID = chosen.ID
		if params.LocationID == "" {
			params.LocationID = chosen.LocationID.String
		}
	}
	sv, err := s.Store.CreateService(r.Context(), params)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	// Kick off provisioning asynchronously; best-effort. If no node available, surface as failed.
	if chosen == nil {
		const msg = "no node available to provision on"
		_ = s.Store.UpdateServiceStatus(r.Context(), sv.ID, "failed", msg)
		sv.Status = "failed"
		sv.ErrorMessage = sql.NullString{String: msg, Valid: true}
	} else {
		go s.provisionService(sv.ID)
	}
	writeJSON(w, 201, toServiceResp(*sv))
}

func (s *Server) handleGetService(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	id := chiURLParam(r, "id")
	sv, err := s.Store.GetService(r.Context(), id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if sv == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	if herr := s.requireOrgRole(r.Context(), uid, sv.OrgID, "member"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	writeJSON(w, 200, toServiceResp(*sv))
}

func (s *Server) handleGetServiceConnection(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	id := chiURLParam(r, "id")
	sv, err := s.Store.GetService(r.Context(), id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if sv == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	if herr := s.requireOrgRole(r.Context(), uid, sv.OrgID, "admin"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	pw := ""
	if len(sv.PasswordEnc) > 0 {
		v, err := envcrypt.Decrypt(s.Cfg.EncryptKey, sv.PasswordEnc)
		if err != nil {
			// Silently returning an empty password would hand the caller a
			// URI like `postgres://opencel:@host:port/db` that connects to
			// nothing — fail loud so they know the encrypt key was rotated
			// (or the blob is corrupt) instead of chasing a mystery 401.
			writeJSON(w, 500, map[string]any{"error": "failed to decrypt service password: " + err.Error()})
			return
		}
		pw = string(v)
	}
	host := sv.InternalHost.String
	port := int(sv.InternalPort.Int64)
	if host == "" || port == 0 {
		writeJSON(w, 200, map[string]any{
			"status":   sv.Status,
			"kind":     sv.Kind,
			"password": pw,
			"username": sv.Username.String,
			"database": sv.DatabaseName.String,
		})
		return
	}
	var uri string
	switch sv.Kind {
	case "postgres":
		uri = fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable", sv.Username.String, pw, host, port, sv.DatabaseName.String)
	case "redis":
		uri = fmt.Sprintf("redis://:%s@%s:%d/0", pw, host, port)
	case "mysql":
		uri = fmt.Sprintf("mysql://%s:%s@%s:%d/%s", sv.Username.String, pw, host, port, sv.DatabaseName.String)
	case "mongodb":
		uri = fmt.Sprintf("mongodb://%s:%s@%s:%d/%s", sv.Username.String, pw, host, port, sv.DatabaseName.String)
	}
	writeJSON(w, 200, map[string]any{
		"status":   sv.Status,
		"kind":     sv.Kind,
		"host":     host,
		"port":     port,
		"username": sv.Username.String,
		"password": pw,
		"database": sv.DatabaseName.String,
		"uri":      uri,
	})
}

func (s *Server) handleDeleteService(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	id := chiURLParam(r, "id")
	sv, err := s.Store.GetService(r.Context(), id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if sv == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	if herr := s.requireOrgRole(r.Context(), uid, sv.OrgID, "admin"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}
	// Flip to 'deleting' BEFORE launching the async removal so a concurrent
	// provisionService goroutine sees it on its post-creation recheck and
	// unwinds the freshly created container instead of stamping it running.
	// If this update fails (e.g. client disconnect cancels r.Context(), or
	// a transient DB error), we can't rely on that race-protection — don't
	// kick off the goroutine; the caller can retry the DELETE.
	if err := s.Store.UpdateServiceStatus(r.Context(), id, "deleting", ""); err != nil {
		writeJSON(w, 500, map[string]any{"error": "failed to mark service for deletion: " + err.Error()})
		return
	}
	containerName := sv.ContainerName.String
	nodeID := sv.NodeID.String
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		// Removal has to follow where the container actually lives: local
		// docker for the primary, a signed HTTP call to the agent for
		// workers. Otherwise the DB row vanishes but the container keeps
		// running on the worker forever.
		var remErr error
		if nodeID != "" {
			if n, err := s.Store.GetNode(ctx, nodeID); err == nil && n != nil {
				if n.Role != "primary" && n.AgentURL.String != "" {
					var agentToken string
					if len(n.TokenEnc) > 0 {
						if v, derr := envcrypt.Decrypt(s.Cfg.EncryptKey, n.TokenEnc); derr == nil {
							agentToken = string(v)
						} else {
							remErr = fmt.Errorf("decrypt agent token: %w", derr)
						}
					}
					if remErr == nil && agentToken == "" {
						// Without a token the agent would 401; sending the
						// request just masks the orphan behind a confusing
						// 401 in the stored error message.
						remErr = fmt.Errorf("missing agent token for node %s; re-create the node", n.ID)
					}
					if remErr == nil {
						remErr = removeServiceContainerRemote(ctx, n.AgentURL.String, agentToken, containerName)
					}
				} else {
					remErr = removeServiceContainer(containerName)
				}
			} else if err != nil {
				remErr = err
			} else {
				// Node vanished (e.g. deleted concurrently); nothing we can
				// sensibly do — drop the DB row so the service doesn't
				// linger in 'deleting' forever.
				remErr = nil
			}
		} else {
			remErr = removeServiceContainer(containerName)
		}
		if remErr != nil {
			// Don't drop the row — leaving the record lets an admin retry
			// or intervene manually; deleting would orphan a live container.
			_ = s.Store.UpdateServiceStatus(ctx, id, "failed", fmt.Sprintf("delete failed: %s", remErr.Error()))
			return
		}
		_ = s.Store.DeleteService(ctx, id)
	}()
	writeJSON(w, 200, map[string]any{"ok": true})
}
