package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
)

var slugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`)

type createProjectReq struct {
	Slug         string `json:"slug"`
	RepoFullName string `json:"repo_full_name"` // owner/repo
}

func (s *Server) firstOrgIDForUser(ctx context.Context, userID string) (string, error) {
	orgs, err := s.Store.ListOrganizationsByUser(ctx, userID)
	if err != nil {
		return "", err
	}
	if len(orgs) == 0 {
		return "", nil
	}
	return orgs[0].ID, nil
}

func (s *Server) handleCreateProjectInOrg(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if err := s.requireOrgRole(r.Context(), uid, orgID, "admin"); err != nil {
		writeJSON(w, err.status, map[string]any{"error": err.msg})
		return
	}
	s.handleCreateProjectWithOrg(w, r, orgID)
}

// Compatibility (deprecated): uses the first org the user belongs to.
func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID, err := s.firstOrgIDForUser(r.Context(), uid)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if orgID == "" {
		writeJSON(w, 400, map[string]any{"error": "no org found (complete setup first)"})
		return
	}
	if err := s.requireOrgRole(r.Context(), uid, orgID, "admin"); err != nil {
		writeJSON(w, err.status, map[string]any{"error": err.msg})
		return
	}
	s.handleCreateProjectWithOrg(w, r, orgID)
}

func (s *Server) handleCreateProjectWithOrg(w http.ResponseWriter, r *http.Request, orgID string) {
	var req createProjectReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	req.RepoFullName = strings.TrimSpace(req.RepoFullName)
	if !slugRe.MatchString(req.Slug) {
		writeJSON(w, 400, map[string]any{"error": "invalid slug (use lowercase letters, numbers, and hyphens)"})
		return
	}
	parts := strings.Split(req.RepoFullName, "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		writeJSON(w, 400, map[string]any{"error": "repo_full_name must be owner/repo"})
		return
	}
	owner, repo := parts[0], parts[1]

	var installationID *int64
	var defaultBranch *string
	if s.GH != nil {
		inst, err := s.GH.GetRepoInstallation(r.Context(), owner, repo)
		if err != nil {
			writeJSON(w, 400, map[string]any{"error": fmt.Sprintf("github installation lookup failed: %v", err)})
			return
		}
		installationID = &inst.ID
		token, err := s.GH.CreateInstallationToken(r.Context(), inst.ID)
		if err != nil {
			writeJSON(w, 400, map[string]any{"error": fmt.Sprintf("github installation token failed: %v", err)})
			return
		}
		repoInfo, err := s.GH.GetRepo(r.Context(), token, owner, repo)
		if err != nil {
			writeJSON(w, 400, map[string]any{"error": fmt.Sprintf("github repo lookup failed: %v", err)})
			return
		}
		defaultBranch = &repoInfo.DefaultBranch
	}

	p, err := s.Store.CreateProject(r.Context(), orgID, req.Slug, req.RepoFullName, installationID, defaultBranch)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	resp := toProjectResp(p)
	writeJSON(w, 201, resp)
}

func (s *Server) handleListProjectsInOrg(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if err := s.requireOrgRole(r.Context(), uid, orgID, "member"); err != nil {
		writeJSON(w, err.status, map[string]any{"error": err.msg})
		return
	}
	ps, err := s.Store.ListProjectsByOrg(r.Context(), orgID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	out := make([]projectResp, 0, len(ps))
	for i := range ps {
		p := ps[i]
		out = append(out, toProjectResp(&p))
	}
	writeJSON(w, 200, out)
}

// Compatibility (deprecated): uses the first org the user belongs to.
func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID, err := s.firstOrgIDForUser(r.Context(), uid)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if orgID == "" {
		writeJSON(w, 200, []any{})
		return
	}
	ps, err := s.Store.ListProjectsByOrg(r.Context(), orgID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	out := make([]projectResp, 0, len(ps))
	for i := range ps {
		p := ps[i]
		out = append(out, toProjectResp(&p))
	}
	writeJSON(w, 200, out)
}

func (s *Server) handleGetProjectInOrg(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if err := s.requireOrgRole(r.Context(), uid, orgID, "member"); err != nil {
		writeJSON(w, err.status, map[string]any{"error": err.msg})
		return
	}
	id := chiURLParam(r, "id")
	p, err := s.Store.GetProject(r.Context(), id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if p == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	if p.OrgID != orgID {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	writeJSON(w, 200, toProjectResp(p))
}

func (s *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	id := chiURLParam(r, "id")
	p, err := s.Store.GetProject(r.Context(), id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if p == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	ok, err := s.Store.IsUserOrgMember(r.Context(), uid, p.OrgID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if !ok {
		writeJSON(w, 403, map[string]any{"error": "forbidden"})
		return
	}
	writeJSON(w, 200, toProjectResp(p))
}
