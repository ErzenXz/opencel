package api

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/opencel/opencel/internal/crypto/envcrypt"
)

type envVarReq struct {
	Scope string `json:"scope"` // preview|production
	Key   string `json:"key"`
	Value string `json:"value"`
}

type envVarResp struct {
	Scope string `json:"scope"`
	Key   string `json:"key"`
	// Value is intentionally omitted in list responses.
}

func (s *Server) handleSetEnvVar(w http.ResponseWriter, r *http.Request) {
	projectID := chiURLParam(r, "id")
	var req envVarReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	req.Scope = strings.ToLower(strings.TrimSpace(req.Scope))
	req.Key = strings.TrimSpace(req.Key)
	if req.Scope != "preview" && req.Scope != "production" {
		writeJSON(w, 400, map[string]any{"error": "scope must be preview or production"})
		return
	}
	if req.Key == "" || strings.Contains(req.Key, " ") {
		writeJSON(w, 400, map[string]any{"error": "invalid key"})
		return
	}
	blob, err := envcrypt.Encrypt(s.Cfg.EncryptKey, []byte(req.Value))
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if err := s.Store.UpsertEnvVar(r.Context(), projectID, req.Scope, req.Key, blob); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "value_enc_b64": base64.StdEncoding.EncodeToString(blob)})
}

func (s *Server) handleListEnvVars(w http.ResponseWriter, r *http.Request) {
	projectID := chiURLParam(r, "id")
	scope := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("scope")))
	if scope != "" && scope != "preview" && scope != "production" {
		writeJSON(w, 400, map[string]any{"error": "scope must be preview or production"})
		return
	}
	vars, err := s.Store.ListEnvVars(r.Context(), projectID, scope)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	out := make([]envVarResp, 0, len(vars))
	for _, v := range vars {
		out = append(out, envVarResp{Scope: v.Scope, Key: v.Key})
	}
	writeJSON(w, 200, out)
}

