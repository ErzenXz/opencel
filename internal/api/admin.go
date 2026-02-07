package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/hibiken/asynq"
	"github.com/opencel/opencel/internal/integrations"
	"github.com/opencel/opencel/internal/queue"
)

type ctxKeyAdmin string

const ctxIsInstanceAdmin ctxKeyAdmin = "is_instance_admin"

func (s *Server) requireInstanceAdminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		uid := userIDFromCtx(r.Context())
		if uid == "" {
			writeJSON(w, 401, map[string]any{"error": "unauthorized"})
			return
		}
		u, err := s.Store.GetUserByID(r.Context(), uid)
		if err != nil || u == nil {
			writeJSON(w, 401, map[string]any{"error": "unauthorized"})
			return
		}
		if !u.IsInstanceAdmin {
			writeJSON(w, 403, map[string]any{"error": "forbidden"})
			return
		}
		ctx := context.WithValue(r.Context(), ctxIsInstanceAdmin, true)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ---- Settings API ----

type adminSettingsResp struct {
	BaseDomain   string `json:"base_domain"`
	PublicScheme string `json:"public_scheme"`
	TLSMode      string `json:"tls_mode"` // letsencrypt | cloudflared | disabled

	GitHubOAuthClientIDConfigured     bool   `json:"github_oauth_client_id_configured"`
	GitHubOAuthClientID               string `json:"github_oauth_client_id,omitempty"`
	GitHubOAuthClientSecretConfigured bool   `json:"github_oauth_client_secret_configured"`

	GitHubAppIDConfigured            bool   `json:"github_app_id_configured"`
	GitHubAppID                      string `json:"github_app_id,omitempty"`
	GitHubAppWebhookSecretConfigured bool   `json:"github_app_webhook_secret_configured"`
	GitHubAppPrivateKeyConfigured    bool   `json:"github_app_private_key_configured"`

	AutoUpdatesEnabled  bool   `json:"auto_updates_enabled"`
	AutoUpdatesInterval string `json:"auto_updates_interval"` // hourly | daily (UI only in M3)
}

func (s *Server) handleAdminGetSettings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	resp := adminSettingsResp{
		BaseDomain:   s.Cfg.BaseDomain,
		PublicScheme: s.Cfg.PublicScheme,
		TLSMode: func() string {
			if s.Cfg.TraefikTLS {
				return "letsencrypt"
			}
			return "disabled"
		}(),
		AutoUpdatesEnabled:  true,
		AutoUpdatesInterval: "hourly",
	}

	// GitHub OAuth.
	{
		var v struct {
			ClientID string `json:"client_id"`
		}
		if ok, _ := s.Settings.GetJSON(ctx, integrations.KeyGitHubOAuthClientID, &v); ok && v.ClientID != "" {
			resp.GitHubOAuthClientIDConfigured = true
			resp.GitHubOAuthClientID = v.ClientID
		}
		secOK, _ := s.Settings.HasSecret(ctx, integrations.KeyGitHubOAuthClientSecret)
		resp.GitHubOAuthClientSecretConfigured = secOK
	}

	// GitHub App.
	{
		var v struct {
			AppID string `json:"app_id"`
		}
		if ok, _ := s.Settings.GetJSON(ctx, integrations.KeyGitHubAppID, &v); ok && v.AppID != "" {
			resp.GitHubAppIDConfigured = true
			resp.GitHubAppID = v.AppID
		}
		secOK, _ := s.Settings.HasSecret(ctx, integrations.KeyGitHubWebhookSecret)
		resp.GitHubAppWebhookSecretConfigured = secOK
		keyOK, _ := s.Settings.HasSecret(ctx, integrations.KeyGitHubPrivateKeyPEM)
		resp.GitHubAppPrivateKeyConfigured = keyOK
	}

	writeJSON(w, 200, resp)
}

type adminSettingsPutReq struct {
	BaseDomain   *string `json:"base_domain,omitempty"`
	PublicScheme *string `json:"public_scheme,omitempty"`
	TLSMode      *string `json:"tls_mode,omitempty"`

	GitHubOAuthClientID     *string `json:"github_oauth_client_id,omitempty"`
	GitHubOAuthClientSecret *string `json:"github_oauth_client_secret,omitempty"` // write-only

	GitHubAppID            *string `json:"github_app_id,omitempty"`
	GitHubAppWebhookSecret *string `json:"github_app_webhook_secret,omitempty"`  // write-only
	GitHubAppPrivateKeyPEM *string `json:"github_app_private_key_pem,omitempty"` // write-only

	AutoUpdatesEnabled  *bool   `json:"auto_updates_enabled,omitempty"`
	AutoUpdatesInterval *string `json:"auto_updates_interval,omitempty"` // hourly | daily
}

func (s *Server) handleAdminPutSettings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req adminSettingsPutReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}

	// Store settings (DB) first. Agent apply will later write to compose/env when needed.
	if req.GitHubOAuthClientID != nil {
		_ = s.Settings.SetJSON(ctx, integrations.KeyGitHubOAuthClientID, map[string]any{"client_id": strings.TrimSpace(*req.GitHubOAuthClientID)})
	}
	if req.GitHubOAuthClientSecret != nil {
		_ = s.Settings.SetSecret(ctx, integrations.KeyGitHubOAuthClientSecret, []byte(strings.TrimSpace(*req.GitHubOAuthClientSecret)))
	}

	if req.GitHubAppID != nil {
		_ = s.Settings.SetJSON(ctx, integrations.KeyGitHubAppID, map[string]any{"app_id": strings.TrimSpace(*req.GitHubAppID)})
	}
	if req.GitHubAppWebhookSecret != nil {
		_ = s.Settings.SetSecret(ctx, integrations.KeyGitHubWebhookSecret, []byte(strings.TrimSpace(*req.GitHubAppWebhookSecret)))
	}
	if req.GitHubAppPrivateKeyPEM != nil {
		_ = s.Settings.SetSecret(ctx, integrations.KeyGitHubPrivateKeyPEM, []byte(*req.GitHubAppPrivateKeyPEM))
	}

	// Optional: store instance domain/tls preferences (agent will apply).
	if req.BaseDomain != nil {
		_ = s.Settings.SetJSON(ctx, integrations.KeyBaseDomain, map[string]any{"base_domain": strings.TrimSpace(*req.BaseDomain)})
	}
	if req.PublicScheme != nil {
		_ = s.Settings.SetJSON(ctx, integrations.KeyPublicScheme, map[string]any{"public_scheme": strings.TrimSpace(*req.PublicScheme)})
	}
	if req.TLSMode != nil {
		_ = s.Settings.SetJSON(ctx, integrations.KeyTLSMode, map[string]any{"tls_mode": strings.TrimSpace(*req.TLSMode)})
	}
	if req.AutoUpdatesEnabled != nil || req.AutoUpdatesInterval != nil {
		m := map[string]any{}
		if req.AutoUpdatesEnabled != nil {
			m["enabled"] = *req.AutoUpdatesEnabled
		}
		if req.AutoUpdatesInterval != nil {
			m["interval"] = strings.TrimSpace(*req.AutoUpdatesInterval)
		}
		_ = s.Settings.SetJSON(ctx, integrations.KeyAutoUpdates, m)
	}

	s.GHProvider.Invalidate()
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleAdminApply(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	j, err := s.Store.CreateAdminJob(r.Context(), "apply_settings", &uid)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	task := asynq.NewTask(queue.TaskApplySettings, queue.MustJSON(queue.AdminJobPayload{JobID: j.ID}))
	if _, err := s.Queue.Enqueue(task); err != nil {
		_ = s.Store.SetAdminJobStatus(r.Context(), j.ID, "failed", ptrString(err.Error()))
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 202, map[string]any{"job_id": j.ID})
}

func (s *Server) handleAdminSelfUpdate(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	j, err := s.Store.CreateAdminJob(r.Context(), "self_update", &uid)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	task := asynq.NewTask(queue.TaskSelfUpdate, queue.MustJSON(queue.AdminJobPayload{JobID: j.ID}))
	if _, err := s.Queue.Enqueue(task); err != nil {
		_ = s.Store.SetAdminJobStatus(r.Context(), j.ID, "failed", ptrString(err.Error()))
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 202, map[string]any{"job_id": j.ID})
}

func (s *Server) handleAdminGetJob(w http.ResponseWriter, r *http.Request) {
	id := chiURLParam(r, "jobID")
	j, err := s.Store.GetAdminJob(r.Context(), id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if j == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	writeJSON(w, 200, map[string]any{
		"id":          j.ID,
		"type":        j.Type,
		"status":      j.Status,
		"created_at":  j.CreatedAt,
		"started_at":  nullTimeJSON(j.StartedAt),
		"finished_at": nullTimeJSON(j.FinishedAt),
		"error":       nullStringJSON(j.Error),
	})
}

func (s *Server) handleAdminGetJobLogs(w http.ResponseWriter, r *http.Request) {
	id := chiURLParam(r, "jobID")
	ls, err := s.Store.ListAdminJobLogs(r.Context(), id, 1000)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	out := make([]map[string]any, 0, len(ls))
	for _, l := range ls {
		out = append(out, map[string]any{
			"id":     l.ID,
			"job_id": l.JobID,
			"ts":     l.TS,
			"stream": l.Stream,
			"chunk":  l.Chunk,
		})
	}
	writeJSON(w, 200, out)
}

func ptrString(s string) *string { return &s }

func nullStringJSON(ns sql.NullString) any {
	if !ns.Valid {
		return nil
	}
	return ns.String
}

func nullTimeJSON(nt sql.NullTime) any {
	if !nt.Valid {
		return nil
	}
	return nt.Time
}
