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
	"github.com/opencel/opencel/internal/integrations"
	"github.com/opencel/opencel/internal/settings"
)

type Server struct {
	Cfg        *config.Config
	Store      *db.Store
	Settings   *settings.Store
	Queue      *asynq.Client
	GHProvider *integrations.GitHubAppProvider

	Router http.Handler
}

func NewServer(cfg *config.Config, store *db.Store) (*Server, error) {
	st := settings.New(store, cfg.EncryptKey)
	s := &Server{
		Cfg:        cfg,
		Store:      store,
		Settings:   st,
		Queue:      asynq.NewClient(asynq.RedisClientOpt{Addr: cfg.RedisAddr}),
		GHProvider: integrations.NewGitHubAppProvider(cfg, st),
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
		r.Get("/setup/status", s.handleSetupStatus)
		r.Post("/setup", s.handleSetup)
		r.Get("/integrations/github/status", s.handleGitHubStatus) // compat
		r.Get("/integrations/github/app/status", s.handleGitHubAppStatus)
		r.Get("/integrations/github/app/install-url", s.handleGitHubAppInstallURL)
		r.Post("/auth/login", s.handleLogin)
		r.Post("/auth/logout", s.handleLogout)
		r.Get("/auth/github/status", s.handleGitHubOAuthStatus)
		r.Get("/auth/github/start", s.handleGitHubOAuthStart)
		r.Get("/auth/github/callback", s.handleGitHubOAuthCallback)

		r.Group(func(r chi.Router) {
			r.Use(s.authMiddleware)
			r.Get("/me", s.handleMe)

			r.Get("/github/me", s.handleGitHubMe)
			r.Get("/github/repos", s.handleGitHubRepos)
			r.Post("/auth/github/disconnect", s.handleGitHubDisconnect)

			r.Route("/admin", func(r chi.Router) {
				r.Use(s.requireInstanceAdminMiddleware)
				r.Get("/settings", s.handleAdminGetSettings)
				r.Put("/settings", s.handleAdminPutSettings)
				r.Post("/apply", s.handleAdminApply)
				r.Post("/self-update", s.handleAdminSelfUpdate)
				r.Get("/jobs/{jobID}", s.handleAdminGetJob)
				r.Get("/jobs/{jobID}/logs", s.handleAdminGetJobLogs)
			})

			r.Get("/orgs", s.handleListOrgs)
			r.Post("/orgs", s.handleCreateOrg)
			r.Get("/orgs/{orgID}", s.handleGetOrg)
			r.Get("/orgs/{orgID}/members", s.handleListOrgMembers)
			r.Post("/orgs/{orgID}/members", s.handleAddOrgMember)
			r.Delete("/orgs/{orgID}/members/{userID}", s.handleRemoveOrgMember)

			r.Post("/orgs/{orgID}/projects", s.handleCreateProjectInOrg)
			r.Post("/orgs/{orgID}/projects/import", s.handleImportProjectInOrg)
			r.Get("/orgs/{orgID}/projects", s.handleListProjectsInOrg)
			r.Get("/orgs/{orgID}/projects/{id}", s.handleGetProjectInOrg)

			// Compatibility (deprecated): picks the first org the user belongs to.
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
