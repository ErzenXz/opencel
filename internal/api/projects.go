package api

import (
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

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
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

	p, err := s.Store.CreateProject(r.Context(), req.Slug, req.RepoFullName, installationID, defaultBranch)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	resp := toProjectResp(p)
	writeJSON(w, 201, resp)
}

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	ps, err := s.Store.ListProjects(r.Context())
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

func (s *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
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
	writeJSON(w, 200, toProjectResp(p))
}
