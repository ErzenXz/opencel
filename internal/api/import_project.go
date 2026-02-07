package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/opencel/opencel/internal/queue"
)

type importProjectReq struct {
	RepoFullName string `json:"repo_full_name"`
	Slug         string `json:"slug,omitempty"`
	RootDir      string `json:"root_dir,omitempty"`
	BuildPreset  string `json:"build_preset,omitempty"`
	Branch       string `json:"branch,omitempty"`
}

func repoToSlug(repoFull string) string {
	parts := strings.Split(repoFull, "/")
	if len(parts) != 2 {
		return ""
	}
	s := strings.ToLower(strings.TrimSpace(parts[1]))
	s = strings.ReplaceAll(s, "_", "-")
	s = strings.ReplaceAll(s, ".", "-")
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.Trim(s, "-")
	if len(s) < 2 {
		return ""
	}
	if len(s) > 32 {
		s = s[:32]
		s = strings.Trim(s, "-")
	}
	return s
}

func (s *Server) handleImportProjectInOrg(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	orgID := chiURLParam(r, "orgID")
	if err := s.requireOrgRole(r.Context(), uid, orgID, "admin"); err != nil {
		writeJSON(w, err.status, map[string]any{"error": err.msg})
		return
	}

	var req importProjectReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	req.RepoFullName = strings.TrimSpace(req.RepoFullName)
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	if req.RepoFullName == "" || !strings.Contains(req.RepoFullName, "/") {
		writeJSON(w, 400, map[string]any{"error": "repo_full_name must be owner/repo"})
		return
	}
	if req.Slug == "" {
		req.Slug = repoToSlug(req.RepoFullName)
	}
	if !slugRe.MatchString(req.Slug) {
		writeJSON(w, 400, map[string]any{"error": "invalid slug"})
		return
	}
	parts := strings.Split(req.RepoFullName, "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		writeJSON(w, 400, map[string]any{"error": "repo_full_name must be owner/repo"})
		return
	}
	owner, repo := parts[0], parts[1]

	gh, cfgd, err := s.GHProvider.Get(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": fmt.Sprintf("github config error: %v", err)})
		return
	}
	if !cfgd || gh == nil {
		writeJSON(w, 400, map[string]any{"error": "github app not configured (configure in Admin)"})
		return
	}

	inst, err := gh.GetRepoInstallation(r.Context(), owner, repo)
	if err != nil {
		writeJSON(w, 409, map[string]any{
			"error":                  fmt.Sprintf("github app not installed or repo not accessible: %v", err),
			"needs_app_installation": true,
		})
		return
	}
	token, err := gh.CreateInstallationToken(r.Context(), inst.ID)
	if err != nil {
		writeJSON(w, 502, map[string]any{"error": fmt.Sprintf("github installation token failed: %v", err)})
		return
	}
	repoInfo, err := gh.GetRepo(r.Context(), token, owner, repo)
	if err != nil {
		writeJSON(w, 502, map[string]any{"error": fmt.Sprintf("github repo lookup failed: %v", err)})
		return
	}
	def := repoInfo.DefaultBranch
	installationID := inst.ID

	p, err := s.Store.CreateProject(r.Context(), orgID, req.Slug, req.RepoFullName, &installationID, &def)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}

	// Store optional project settings JSON.
	if req.RootDir != "" || req.BuildPreset != "" || req.Branch != "" {
		_ = s.Store.UpsertProjectSettingsJSON(r.Context(), p.ID, queue.MustJSON(map[string]any{
			"root_dir":     strings.TrimSpace(req.RootDir),
			"build_preset": strings.TrimSpace(req.BuildPreset),
			"branch":       strings.TrimSpace(req.Branch),
		}))
	}

	writeJSON(w, 201, map[string]any{
		"project": toProjectResp(p),
		"next": map[string]any{
			"push_to_deploy": true,
			"default_branch": def,
		},
	})
}
