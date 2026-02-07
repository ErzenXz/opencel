package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/hibiken/asynq"
	"github.com/opencel/opencel/internal/github"
	"github.com/opencel/opencel/internal/queue"
)

type ghPushPayload struct {
	Ref        string `json:"ref"`   // refs/heads/main
	After      string `json:"after"` // sha
	Repository struct {
		FullName      string `json:"full_name"`
		DefaultBranch string `json:"default_branch"`
	} `json:"repository"`
	Installation struct {
		ID int64 `json:"id"`
	} `json:"installation"`
}

func (s *Server) handleGitHubWebhook(w http.ResponseWriter, r *http.Request) {
	if s.GH == nil {
		writeJSON(w, 400, map[string]any{"error": "github not configured"})
		return
	}
	body, err := github.ReadBody(r)
	if err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid body"})
		return
	}
	if err := github.VerifyWebhookSignature(r, s.Cfg.GitHubWebhookSecret, body); err != nil {
		writeJSON(w, 401, map[string]any{"error": "invalid signature"})
		return
	}
	ev := r.Header.Get("X-GitHub-Event")
	switch ev {
	case "push":
		s.handleGitHubPush(w, r, body)
	default:
		// ignore
		writeJSON(w, 200, map[string]any{"ok": true})
	}
}

func (s *Server) handleGitHubPush(w http.ResponseWriter, r *http.Request, body []byte) {
	var p ghPushPayload
	if err := json.Unmarshal(body, &p); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid payload"})
		return
	}
	repoFull := p.Repository.FullName
	if repoFull == "" || p.After == "" || p.Ref == "" {
		writeJSON(w, 400, map[string]any{"error": "missing fields"})
		return
	}

	project, err := s.Store.GetProjectByRepoFullName(r.Context(), repoFull)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if project == nil {
		// auto-create to allow "push to deploy" with only webhook wiring.
		org, err := s.Store.FirstOrganization(r.Context())
		if err != nil {
			writeJSON(w, 500, map[string]any{"error": err.Error()})
			return
		}
		if org == nil {
			writeJSON(w, 400, map[string]any{"error": "no org exists (complete setup first)"})
			return
		}
		slug := strings.ToLower(strings.ReplaceAll(strings.Split(repoFull, "/")[1], "_", "-"))
		def := p.Repository.DefaultBranch
		inst := p.Installation.ID
		project, err = s.Store.CreateProject(r.Context(), org.ID, slug, repoFull, &inst, &def)
		if err != nil {
			writeJSON(w, 500, map[string]any{"error": err.Error()})
			return
		}
	} else {
		_ = s.Store.UpdateProjectGitHubInfo(r.Context(), project.ID, p.Installation.ID, p.Repository.DefaultBranch)
	}

	branch := strings.TrimPrefix(p.Ref, "refs/heads/")
	typ := "preview"
	if p.Repository.DefaultBranch != "" && branch == p.Repository.DefaultBranch {
		typ = "production"
	}

	dep, err := s.Store.CreateDeployment(r.Context(), project.ID, p.After, p.Ref, typ)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	_ = s.Store.AddDeploymentEvent(r.Context(), dep.ID, "QUEUED", "Deployment queued from GitHub push")

	task := asynq.NewTask(queue.TaskBuildDeploy, queue.MustJSON(queue.BuildDeployPayload{DeploymentID: dep.ID}))
	if _, err := s.Queue.Enqueue(task); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, map[string]any{"ok": true, "deployment_id": dep.ID})
}
