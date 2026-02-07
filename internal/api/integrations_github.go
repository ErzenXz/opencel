package api

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/opencel/opencel/internal/integrations"
)

// Compatibility endpoint (from M2).
func (s *Server) handleGitHubStatus(w http.ResponseWriter, r *http.Request) {
	s.handleGitHubAppStatus(w, r)
}

func (s *Server) handleGitHubAppStatus(w http.ResponseWriter, r *http.Request) {
	gh, cfgd, err := s.GHProvider.Get(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "github config error"})
		return
	}
	appID := ""
	// Prefer DB setting for display, fallback to env.
	var v struct {
		AppID string `json:"app_id"`
	}
	if ok, _ := s.Settings.GetJSON(r.Context(), integrations.KeyGitHubAppID, &v); ok && v.AppID != "" {
		appID = v.AppID
	} else {
		appID = s.Cfg.GitHubAppID
	}
	writeJSON(w, 200, map[string]any{
		"configured": cfgd && gh != nil,
		"app_id":     appID,
	})
}

func (s *Server) handleGitHubAppInstallURL(w http.ResponseWriter, r *http.Request) {
	// Best-effort: GitHub App installation URL uses the app slug; without it we can only show "create app" docs.
	// For now, return a helper link to GitHub App settings using app_id if configured.
	var v struct {
		AppID string `json:"app_id"`
	}
	_, _ = s.Settings.GetJSON(r.Context(), integrations.KeyGitHubAppID, &v)
	appID := strings.TrimSpace(v.AppID)
	if appID == "" {
		appID = strings.TrimSpace(s.Cfg.GitHubAppID)
	}
	if appID == "" {
		writeJSON(w, 400, map[string]any{"error": "github app id not configured"})
		return
	}
	// This is not perfect, but helps users find their app quickly.
	u := &url.URL{Scheme: "https", Host: "github.com", Path: "/settings/apps"}
	writeJSON(w, 200, map[string]any{
		"install_url": u.String(),
		"note":        "Create/locate your GitHub App under GitHub Settings > Developer settings > GitHub Apps, then install it on your org/user. OpenCel will verify installation during project import.",
	})
}
