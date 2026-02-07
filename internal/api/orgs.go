package api

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type orgResp struct {
	ID        string    `json:"id"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	Role      string    `json:"role"`
}

type orgMemberResp struct {
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

var orgNameRe = regexp.MustCompile(`^.{2,64}$`)

func (s *Server) handleListOrgs(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgs, err := s.Store.ListOrganizationsByUser(r.Context(), uid)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	out := make([]orgResp, 0, len(orgs))
	for _, o := range orgs {
		role, err := s.Store.GetOrgRole(r.Context(), uid, o.ID)
		if err != nil {
			writeJSON(w, 500, map[string]any{"error": err.Error()})
			return
		}
		out = append(out, orgResp{ID: o.ID, Slug: o.Slug, Name: o.Name, CreatedAt: o.CreatedAt, Role: role})
	}
	writeJSON(w, 200, out)
}

type createOrgReq struct {
	Name string `json:"name"`
}

func (s *Server) handleCreateOrg(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	var req createOrgReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if !orgNameRe.MatchString(req.Name) {
		writeJSON(w, 400, map[string]any{"error": "invalid name"})
		return
	}
	slug := slugifyOrg(req.Name)
	o, err := s.Store.CreateOrganization(r.Context(), slug, req.Name)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if err := s.Store.AddOrgMember(r.Context(), o.ID, uid, "owner"); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 201, orgResp{ID: o.ID, Slug: o.Slug, Name: o.Name, CreatedAt: o.CreatedAt, Role: "owner"})
}

func (s *Server) handleGetOrg(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	ok, err := s.Store.IsUserOrgMember(r.Context(), uid, orgID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if !ok {
		writeJSON(w, 403, map[string]any{"error": "forbidden"})
		return
	}
	o, err := s.Store.GetOrganization(r.Context(), orgID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if o == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	role, _ := s.Store.GetOrgRole(r.Context(), uid, orgID)
	writeJSON(w, 200, orgResp{ID: o.ID, Slug: o.Slug, Name: o.Name, CreatedAt: o.CreatedAt, Role: role})
}

func (s *Server) handleListOrgMembers(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if err := s.requireOrgRole(r.Context(), uid, orgID, "admin"); err != nil {
		writeJSON(w, err.status, map[string]any{"error": err.msg})
		return
	}
	rows, err := s.Store.ListOrgMembers(r.Context(), orgID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	out := make([]orgMemberResp, 0, len(rows))
	for _, row := range rows {
		out = append(out, orgMemberResp{UserID: row.UserID, Email: row.Email, Role: row.Role, CreatedAt: row.CreatedAt})
	}
	writeJSON(w, 200, out)
}

type addMemberReq struct {
	Email string `json:"email"`
	Role  string `json:"role"` // owner|admin|member
}

func (s *Server) handleAddOrgMember(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if err := s.requireOrgRole(r.Context(), uid, orgID, "admin"); err != nil {
		writeJSON(w, err.status, map[string]any{"error": err.msg})
		return
	}
	var req addMemberReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	req.Role = strings.ToLower(strings.TrimSpace(req.Role))
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		writeJSON(w, 400, map[string]any{"error": "invalid email"})
		return
	}
	if req.Role == "" {
		req.Role = "member"
	}
	if req.Role != "owner" && req.Role != "admin" && req.Role != "member" {
		writeJSON(w, 400, map[string]any{"error": "invalid role"})
		return
	}
	u, err := s.Store.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if u == nil {
		writeJSON(w, 404, map[string]any{"error": "user not found"})
		return
	}
	if err := s.Store.AddOrgMember(r.Context(), orgID, u.ID, req.Role); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleRemoveOrgMember(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	memberID := chiURLParam(r, "userID")
	if err := s.requireOrgRole(r.Context(), uid, orgID, "admin"); err != nil {
		writeJSON(w, err.status, map[string]any{"error": err.msg})
		return
	}
	// Prevent removing self if last owner? For MVP, just allow.
	if err := s.Store.RemoveOrgMember(r.Context(), orgID, memberID); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}
