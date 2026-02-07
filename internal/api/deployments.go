package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/hibiken/asynq"
	"github.com/opencel/opencel/internal/queue"
)

func (s *Server) handleListDeployments(w http.ResponseWriter, r *http.Request) {
	projectID := chiURLParam(r, "id")
	ds, err := s.Store.ListDeploymentsByProject(r.Context(), projectID, 50)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	out := make([]deploymentResp, 0, len(ds))
	for i := range ds {
		d := ds[i]
		out = append(out, toDeploymentResp(&d))
	}
	writeJSON(w, 200, out)
}

func (s *Server) handleGetDeployment(w http.ResponseWriter, r *http.Request) {
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
	writeJSON(w, 200, toDeploymentResp(d))
}

type promoteReq struct {
	ProjectID string `json:"project_id"`
}

func (s *Server) handlePromoteDeployment(w http.ResponseWriter, r *http.Request) {
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

	// Update project pointer.
	if err := s.Store.SetProjectProductionDeployment(r.Context(), d.ProjectID, d.ID); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}

	// Update traefik dynamic config for prod routing.
	if err := s.writeTraefikProdRoute(r.Context(), d.ProjectID); err != nil {
		writeJSON(w, 500, map[string]any{"error": fmt.Sprintf("traefik config update failed: %v", err)})
		return
	}

	_ = s.Store.AddDeploymentEvent(r.Context(), d.ID, "PROMOTED", "Deployment promoted to production")
	writeJSON(w, 200, map[string]any{"ok": true})
}

// Optional endpoint to manually enqueue a build (useful for dev).
func (s *Server) handleEnqueueBuild(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DeploymentID string `json:"deployment_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	t := asynq.NewTask(queue.TaskBuildDeploy, queue.MustJSON(queue.BuildDeployPayload{DeploymentID: body.DeploymentID}))
	if _, err := s.Queue.Enqueue(t); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true})
}
