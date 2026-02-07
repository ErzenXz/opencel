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
	id := chiURLParam(r, "id")
	if _, err := s.Store.GetDeployment(r.Context(), id); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
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
