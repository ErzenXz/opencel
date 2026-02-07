package worker

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/opencel/opencel/internal/config"
	"github.com/opencel/opencel/internal/crypto/envcrypt"
	"github.com/opencel/opencel/internal/db"
	"github.com/opencel/opencel/internal/github"
)

type Worker struct {
	Cfg   *config.Config
	Store *db.Store
	GH    *github.App
}

func New(cfg *config.Config, store *db.Store) (*Worker, error) {
	var ghApp *github.App
	if cfg.GitHubAppID != "" && cfg.GitHubPrivateKeyPEM != "" {
		a, err := github.NewApp(cfg.GitHubAppID, cfg.GitHubPrivateKeyPEM, cfg.GitHubWebhookSecret)
		if err != nil {
			return nil, err
		}
		ghApp = a
	}
	return &Worker{Cfg: cfg, Store: store, GH: ghApp}, nil
}

func (w *Worker) BuildAndDeploy(ctx context.Context, deploymentID string) error {
	d, err := w.Store.GetDeployment(ctx, deploymentID)
	if err != nil || d == nil {
		return fmt.Errorf("deployment not found")
	}
	p, err := w.Store.GetProject(ctx, d.ProjectID)
	if err != nil || p == nil {
		return fmt.Errorf("project not found")
	}
	_ = w.Store.AddDeploymentEvent(ctx, d.ID, "BUILDING", "Build started")
	_ = w.Store.UpdateDeployment(ctx, d.ID, "BUILDING", nil, nil, nil, nil)

	if w.GH == nil {
		return w.fail(ctx, d.ID, "GitHub not configured")
	}
	if !p.GitHubInstallationID.Valid {
		return w.fail(ctx, d.ID, "Project missing GitHub installation id")
	}

	parts := strings.Split(p.RepoFullName, "/")
	if len(parts) != 2 {
		return w.fail(ctx, d.ID, "Invalid repo_full_name")
	}
	owner, repo := parts[0], parts[1]

	token, err := w.GH.CreateInstallationToken(ctx, p.GitHubInstallationID.Int64)
	if err != nil {
		return w.fail(ctx, d.ID, fmt.Sprintf("GitHub token: %v", err))
	}
	zipb, err := w.GH.DownloadZipball(ctx, token, owner, repo, d.GitSHA)
	if err != nil {
		return w.fail(ctx, d.ID, fmt.Sprintf("GitHub zipball: %v", err))
	}

	workDir, cleanup, err := w.extractZip(zipb)
	if err != nil {
		return w.fail(ctx, d.ID, fmt.Sprintf("extract: %v", err))
	}
	defer cleanup()

	appDir, err := w.findRepoRoot(workDir)
	if err != nil {
		return w.fail(ctx, d.ID, fmt.Sprintf("repo root: %v", err))
	}

	spec, err := detectSpec(appDir)
	if err != nil {
		return w.fail(ctx, d.ID, fmt.Sprintf("detect: %v", err))
	}

	dockerfilePath := filepath.Join(appDir, ".opencel.Dockerfile")
	if err := os.WriteFile(dockerfilePath, []byte(spec.Dockerfile), 0o644); err != nil {
		return w.fail(ctx, d.ID, fmt.Sprintf("write dockerfile: %v", err))
	}

	containerName := "opencel-deploy-" + strings.ReplaceAll(d.ID, "-", "")
	imageRef := fmt.Sprintf("%s/opencel/%s:%s", w.Cfg.RegistryAddr, p.Slug, strings.ReplaceAll(d.ID, "-", ""))

	if err := w.runDocker(ctx, d.ID, "build", []string{"build", "-f", dockerfilePath, "-t", imageRef, appDir}...); err != nil {
		return w.fail(ctx, d.ID, fmt.Sprintf("docker build: %v", err))
	}

	// Push to local registry (required so future runs can re-use images / pull by digest).
	_ = w.runDocker(ctx, d.ID, "build", []string{"push", imageRef}...)

	previewHost := fmt.Sprintf("%s.preview.%s", strings.ReplaceAll(d.ID, "-", ""), w.Cfg.BaseDomain)
	previewURL := fmt.Sprintf("https://%s", previewHost)

	labels := []string{
		"traefik.enable=true",
		fmt.Sprintf("traefik.http.routers.%s.rule=Host(\"%s\")", containerName, previewHost),
		fmt.Sprintf("traefik.http.routers.%s.entrypoints=%s", containerName, w.Cfg.TraefikEntrypoint),
		fmt.Sprintf("traefik.http.services.%s.loadbalancer.server.port=%d", containerName, spec.ServicePort),
	}
	if w.Cfg.TraefikTLS {
		labels = append(labels, fmt.Sprintf("traefik.http.routers.%s.tls=true", containerName))
	}

	args := []string{"run", "-d", "--name", containerName, "--network", w.Cfg.DockerNetwork}
	for _, l := range labels {
		args = append(args, "--label", l)
	}

	envs, err := w.loadEnv(ctx, p.ID, d.Type)
	if err != nil {
		return w.fail(ctx, d.ID, fmt.Sprintf("env vars: %v", err))
	}
	// Always provide PORT; apps may ignore it.
	envs = append(envs, "PORT=3000")
	for _, ev := range envs {
		args = append(args, "-e", ev)
	}
	args = append(args, imageRef)

	if err := w.runDocker(ctx, d.ID, "system", args...); err != nil {
		return w.fail(ctx, d.ID, fmt.Sprintf("docker run: %v", err))
	}

	if err := w.Store.UpdateDeployment(ctx, d.ID, "READY", &imageRef, &containerName, &spec.ServicePort, &previewURL); err != nil {
		return w.fail(ctx, d.ID, fmt.Sprintf("db update: %v", err))
	}
	_ = w.Store.AddDeploymentEvent(ctx, d.ID, "READY", "Deployment is ready")
	return nil
}

func (w *Worker) loadEnv(ctx context.Context, projectID string, deployType string) ([]string, error) {
	scope := "preview"
	if deployType == "production" {
		scope = "production"
	}
	vars, err := w.Store.ListEnvVars(ctx, projectID, scope)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(vars))
	for _, v := range vars {
		pt, err := envcrypt.Decrypt(w.Cfg.EncryptKey, v.ValueEnc)
		if err != nil {
			return nil, err
		}
		out = append(out, fmt.Sprintf("%s=%s", v.Key, string(pt)))
	}
	return out, nil
}

func (w *Worker) fail(ctx context.Context, deploymentID, msg string) error {
	_ = w.Store.AppendLogChunk(ctx, deploymentID, "system", msg+"\n")
	_ = w.Store.AddDeploymentEvent(ctx, deploymentID, "FAILED", msg)
	_ = w.Store.UpdateDeployment(ctx, deploymentID, "FAILED", nil, nil, nil, nil)
	return errors.New(msg)
}

func (w *Worker) extractZip(b []byte) (string, func(), error) {
	tmp, err := os.MkdirTemp("", "opencel-src-*")
	if err != nil {
		return "", nil, err
	}
	cleanup := func() { _ = os.RemoveAll(tmp) }

	zr, err := zip.NewReader(bytes.NewReader(b), int64(len(b)))
	if err != nil {
		cleanup()
		return "", nil, err
	}
	for _, f := range zr.File {
		if f.FileInfo().IsDir() {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			cleanup()
			return "", nil, err
		}
		dst := filepath.Join(tmp, f.Name)
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			_ = rc.Close()
			cleanup()
			return "", nil, err
		}
		out, err := os.Create(dst)
		if err != nil {
			_ = rc.Close()
			cleanup()
			return "", nil, err
		}
		_, err = io.Copy(out, rc)
		_ = out.Close()
		_ = rc.Close()
		if err != nil {
			cleanup()
			return "", nil, err
		}
	}
	return tmp, cleanup, nil
}

func (w *Worker) findRepoRoot(tmp string) (string, error) {
	ents, err := os.ReadDir(tmp)
	if err != nil {
		return "", err
	}
	for _, e := range ents {
		if e.IsDir() {
			return filepath.Join(tmp, e.Name()), nil
		}
	}
	return "", fmt.Errorf("no root dir found")
}

type spec struct {
	Type        string
	ServicePort int
	Dockerfile  string
}

type opencelJSON struct {
	Type      string `json:"type"`
	OutputDir string `json:"outputDir"`
}

func detectSpec(appDir string) (*spec, error) {
	// Optional explicit config.
	if b, err := os.ReadFile(filepath.Join(appDir, "opencel.json")); err == nil {
		var cfg opencelJSON
		if err := json.Unmarshal(b, &cfg); err == nil && cfg.Type != "" {
			if cfg.Type == "static" {
				outDir := cfg.OutputDir
				if outDir == "" {
					outDir = "dist"
				}
				return &spec{
					Type:        "static",
					ServicePort: 80,
					Dockerfile: staticDockerfile(outDir),
				}, nil
			}
		}
	}

	// Heuristic: package.json implies node app.
	if _, err := os.Stat(filepath.Join(appDir, "package.json")); err == nil {
		return &spec{
			Type:        "node",
			ServicePort: 3000,
			Dockerfile:  nodeDockerfile(),
		}, nil
	}

	// Fallback static (serving repo contents as html).
	return &spec{
		Type:        "static",
		ServicePort: 80,
		Dockerfile:  staticDockerfile("."),
	}, nil
}

func nodeDockerfile() string {
	return `FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN if [ -f package.json ] && node -e "const p=require('./package.json'); process.exit(p.scripts&&p.scripts.build?0:1)"; then npm run build; else echo "no build script"; fi

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["npm","run","start"]
`
}

func staticDockerfile(outputDir string) string {
	return fmt.Sprintf(`FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package.json ]; then npm ci; fi
COPY . .
RUN if [ -f package.json ] && node -e "const p=require('./package.json'); process.exit(p.scripts&&p.scripts.build?0:1)"; then npm run build; else echo "no build script"; fi

FROM nginx:alpine
COPY --from=build /app/%s /usr/share/nginx/html
EXPOSE 80
`, outputDir)
}

type logWriter struct {
	ctx          context.Context
	store        *db.Store
	deploymentID string
	stream       string
	buf          []byte
	lastFlush    time.Time
}

func newLogWriter(ctx context.Context, store *db.Store, deploymentID, stream string) *logWriter {
	return &logWriter{
		ctx:          ctx,
		store:        store,
		deploymentID: deploymentID,
		stream:       stream,
		lastFlush:    time.Now(),
	}
}

func (lw *logWriter) Write(p []byte) (int, error) {
	lw.buf = append(lw.buf, p...)
	// Flush periodically or when buffer is large.
	if len(lw.buf) > 8*1024 || time.Since(lw.lastFlush) > 500*time.Millisecond {
		lw.flush()
	}
	return len(p), nil
}

func (lw *logWriter) flush() {
	if len(lw.buf) == 0 {
		return
	}
	_ = lw.store.AppendLogChunk(lw.ctx, lw.deploymentID, lw.stream, string(lw.buf))
	lw.buf = lw.buf[:0]
	lw.lastFlush = time.Now()
}

func (w *Worker) runDocker(ctx context.Context, deploymentID, stream string, args ...string) error {
	cmd := exec.CommandContext(ctx, "docker", args...)
	lw := newLogWriter(ctx, w.Store, deploymentID, stream)
	defer lw.flush()
	cmd.Stdout = lw
	cmd.Stderr = lw
	err := cmd.Run()
	if err != nil {
		lw.flush()
		return err
	}
	return nil
}
