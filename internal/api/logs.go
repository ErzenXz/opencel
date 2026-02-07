package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

// SSE endpoint. Clients can pass ?after=<id> to resume.
func (s *Server) handleDeploymentLogsSSE(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	id := chiURLParam(r, "id")
	d, err := s.Store.GetDeployment(r.Context(), id)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if d == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	p, err := s.Store.GetProject(r.Context(), d.ProjectID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if p == nil {
		writeJSON(w, 404, map[string]any{"error": "not found"})
		return
	}
	if herr := s.requireOrgRole(r.Context(), uid, p.OrgID, "member"); herr != nil {
		writeJSON(w, herr.status, map[string]any{"error": herr.msg})
		return
	}

	afterID := int64(0)
	if v := r.URL.Query().Get("after"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			afterID = n
		}
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	fl, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, 500, map[string]any{"error": "streaming not supported"})
		return
	}

	ticker := time.NewTicker(750 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			chunks, err := s.Store.ListLogChunks(r.Context(), id, afterID, 500)
			if err != nil {
				fmt.Fprintf(w, "event: error\ndata: %q\n\n", err.Error())
				fl.Flush()
				return
			}
			for _, c := range chunks {
				afterID = c.ID
				// Use id to support resume.
				b, _ := json.Marshal(toLogChunkResp(c))
				fmt.Fprintf(w, "id: %d\nevent: log\ndata: %s\n\n", c.ID, string(b))
			}
			fl.Flush()
		}
	}
}
