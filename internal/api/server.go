package api

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/hibiken/asynq"
	"github.com/opencel/opencel/internal/config"
	"github.com/opencel/opencel/internal/db"
	"github.com/opencel/opencel/internal/github"
)

type Server struct {
	Cfg   *config.Config
	Store *db.Store
	Queue *asynq.Client
	GH    *github.App

	Router http.Handler
}

func NewServer(cfg *config.Config, store *db.Store) (*Server, error) {
	var ghApp *github.App
	if cfg.GitHubAppID != "" && cfg.GitHubPrivateKeyPEM != "" {
		a, err := github.NewApp(cfg.GitHubAppID, cfg.GitHubPrivateKeyPEM, cfg.GitHubWebhookSecret)
		if err != nil {
			return nil, err
		}
		ghApp = a
	}

	s := &Server{
		Cfg:   cfg,
		Store: store,
		Queue: asynq.NewClient(asynq.RedisClientOpt{Addr: cfg.RedisAddr}),
		GH:    ghApp,
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Compress(5))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:3000",
			"http://localhost:3001",
			"http://127.0.0.1:3000",
			"http://127.0.0.1:3001",
			fmt.Sprintf("https://%s", cfg.BaseDomain),
			fmt.Sprintf("http://%s", cfg.BaseDomain),
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/api", func(r chi.Router) {
		r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(200)
			_, _ = w.Write([]byte("ok"))
		})
		r.Post("/auth/login", s.handleLogin)
		r.Post("/auth/logout", s.handleLogout)

		r.Group(func(r chi.Router) {
			r.Use(s.authMiddleware)
			r.Get("/me", s.handleMe)

			r.Post("/projects", s.handleCreateProject)
			r.Get("/projects", s.handleListProjects)
			r.Get("/projects/{id}", s.handleGetProject)
			r.Post("/projects/{id}/env", s.handleSetEnvVar)
			r.Get("/projects/{id}/env", s.handleListEnvVars)
			r.Get("/projects/{id}/deployments", s.handleListDeployments)

			r.Get("/deployments/{id}", s.handleGetDeployment)
			r.Post("/deployments/{id}/promote", s.handlePromoteDeployment)
			r.Get("/deployments/{id}/logs", s.handleDeploymentLogsSSE)
		})

		// GitHub webhooks do not require auth cookie, but must verify signature.
		r.Post("/webhooks/github", s.handleGitHubWebhook)
	})

	s.Router = r
	return s, nil
}
