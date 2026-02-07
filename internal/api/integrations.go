package api

import (
	"net/http"
)

func (s *Server) handleGitHubStatus(w http.ResponseWriter, r *http.Request) {
	// "Configured" means the API/worker can use GitHub App auth and verify webhook signatures.
	cfgd := s.Cfg.GitHubAppID != "" && s.Cfg.GitHubWebhookSecret != "" && s.Cfg.GitHubPrivateKeyPEM != ""
	writeJSON(w, 200, map[string]any{
		"configured": cfgd,
		"app_id":     s.Cfg.GitHubAppID,
	})
}
