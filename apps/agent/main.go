package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/hibiken/asynq"
	"github.com/opencel/opencel/internal/config"
	"github.com/opencel/opencel/internal/db"
	"github.com/opencel/opencel/internal/integrations"
	"github.com/opencel/opencel/internal/queue"
	"github.com/opencel/opencel/internal/settings"
)

func main() {
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	conn, err := db.Open(cfg.DSN)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer conn.Close()

	store := db.NewStore(conn)
	st := settings.New(store, cfg.EncryptKey)

	installDir := envOr("OPENCEL_INSTALL_DIR", "/opt/opencel")
	repoDir := envOr("OPENCEL_REPO_DIR", "/opt/opencel-src")
	opencelBin := envOr("OPENCEL_BIN", "/usr/local/bin/opencel")

	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: cfg.RedisAddr},
		asynq.Config{Concurrency: 1},
	)

	mux := asynq.NewServeMux()
	mux.HandleFunc(queue.TaskApplySettings, func(ctx context.Context, t *asynq.Task) error {
		var p queue.AdminJobPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return err
		}
		return runAdminJob(ctx, store, st, p.JobID, "apply_settings", func(ctx context.Context, logf func(string)) error {
			return applySettings(ctx, st, installDir, repoDir, opencelBin, logf)
		})
	})
	mux.HandleFunc(queue.TaskSelfUpdate, func(ctx context.Context, t *asynq.Task) error {
		var p queue.AdminJobPayload
		if err := json.Unmarshal(t.Payload(), &p); err != nil {
			return err
		}
		return runAdminJob(ctx, store, st, p.JobID, "self_update", func(ctx context.Context, logf func(string)) error {
			return selfUpdate(ctx, installDir, repoDir, opencelBin, logf)
		})
	})

	log.Printf("agent started")
	if err := srv.Run(mux); err != nil {
		log.Fatalf("asynq: %v", err)
	}
}

func envOr(k, def string) string {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		return def
	}
	return v
}

func runAdminJob(ctx context.Context, store *db.Store, st *settings.Store, jobID, typ string, fn func(context.Context, func(string)) error) error {
	_ = store.SetAdminJobStatus(ctx, jobID, "running", nil)
	logf := func(line string) {
		if !strings.HasSuffix(line, "\n") {
			line += "\n"
		}
		_ = store.AppendAdminJobLog(ctx, jobID, "system", line)
	}
	logf("starting " + typ)

	if err := fn(ctx, logf); err != nil {
		msg := err.Error()
		logf("failed: " + msg)
		_ = store.SetAdminJobStatus(ctx, jobID, "failed", &msg)
		return err
	}
	logf("success")
	_ = store.SetAdminJobStatus(ctx, jobID, "success", nil)
	return nil
}

func applySettings(ctx context.Context, st *settings.Store, installDir, repoDir, opencelBin string, logf func(string)) error {
	// Best-effort write of a few installer-managed env vars from DB settings.
	baseDomain := ""
	publicScheme := ""
	tlsMode := "letsencrypt"

	{
		var v struct {
			BaseDomain string `json:"base_domain"`
		}
		if ok, _ := st.GetJSON(ctx, integrations.KeyBaseDomain, &v); ok {
			baseDomain = strings.TrimSpace(v.BaseDomain)
		}
	}
	{
		var v struct {
			PublicScheme string `json:"public_scheme"`
		}
		if ok, _ := st.GetJSON(ctx, integrations.KeyPublicScheme, &v); ok {
			publicScheme = strings.TrimSpace(v.PublicScheme)
		}
	}
	{
		var v struct {
			TLSMode string `json:"tls_mode"`
		}
		if ok, _ := st.GetJSON(ctx, integrations.KeyTLSMode, &v); ok && strings.TrimSpace(v.TLSMode) != "" {
			tlsMode = strings.TrimSpace(strings.ToLower(v.TLSMode))
		}
	}

	// GitHub App config (also written into env for backwards compatibility).
	appID := ""
	whSecret := ""
	privKey := ""
	{
		var v struct {
			AppID string `json:"app_id"`
		}
		if ok, _ := st.GetJSON(ctx, integrations.KeyGitHubAppID, &v); ok {
			appID = strings.TrimSpace(v.AppID)
		}
	}
	if b, ok, _ := st.GetSecret(ctx, integrations.KeyGitHubWebhookSecret); ok {
		whSecret = strings.TrimSpace(string(b))
	}
	if b, ok, _ := st.GetSecret(ctx, integrations.KeyGitHubPrivateKeyPEM); ok {
		privKey = string(b)
	}

	if baseDomain != "" {
		logf("will set base_domain=" + baseDomain)
	}
	if publicScheme != "" {
		logf("will set public_scheme=" + publicScheme)
	}
	logf("will set tls_mode=" + tlsMode)
	if appID != "" {
		logf("github app id configured")
	}
	if whSecret != "" {
		logf("github webhook secret configured")
	}

	// Write secrets file if provided.
	if privKey != "" {
		if err := os.MkdirAll(installDir+"/secrets", 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(installDir+"/secrets/github_app_private_key.pem", []byte(privKey), 0o600); err != nil {
			return err
		}
	}

	// Update /opt/opencel/.env so containers have updated defaults even without DB settings support.
	envUpdates := map[string]string{}
	if baseDomain != "" {
		envUpdates["OPENCEL_BASE_DOMAIN"] = baseDomain
	}
	if publicScheme != "" {
		envUpdates["OPENCEL_PUBLIC_SCHEME"] = publicScheme
	}
	switch tlsMode {
	case "cloudflared":
		envUpdates["OPENCEL_TRAEFIK_TLS"] = "false"
		envUpdates["OPENCEL_TRAEFIK_CERT_RESOLVER"] = ""
	default:
		envUpdates["OPENCEL_TRAEFIK_TLS"] = "true"
		envUpdates["OPENCEL_TRAEFIK_CERT_RESOLVER"] = "le"
	}
	if appID != "" {
		envUpdates["OPENCEL_GITHUB_APP_ID"] = appID
	}
	if whSecret != "" {
		envUpdates["OPENCEL_GITHUB_WEBHOOK_SECRET"] = whSecret
	}
	if len(envUpdates) > 0 {
		if err := updateDotEnv(installDir+"/.env", envUpdates); err != nil {
			logf("warn: update .env failed: " + err.Error())
		}
	}

	// Prefer installer (keeps templates in sync). Fallback to docker compose restart for release installs.
	if fi, err := os.Stat(opencelBin); err == nil && (fi.Mode()&0o111) != 0 && repoDir != "" {
		args := []string{"install", "--local-build", "--non-interactive", "--repo", repoDir, "--dir", installDir}
		if tlsMode == "letsencrypt" {
			args = append(args, "--tls", "letsencrypt")
		} else if tlsMode == "cloudflared" {
			args = append(args, "--tls", "cloudflared")
		} else {
			args = append(args, "--tls", "disabled")
		}
		logf("exec: " + opencelBin + " " + strings.Join(args, " "))
		return runCmd(ctx, logf, opencelBin, args...)
	}

	logf("installer not available; restarting via docker compose")
	if err := runCmd(ctx, logf, "docker", "compose", "-f", installDir+"/docker-compose.yml", "up", "-d"); err != nil {
		return err
	}
	_ = runCmd(ctx, logf, "docker", "compose", "-f", installDir+"/docker-compose.yml", "restart", "api", "worker", "web")
	return nil
}

func updateDotEnv(path string, updates map[string]string) error {
	b, err := os.ReadFile(path)
	if err != nil {
		// If missing, create.
		var lines []string
		for k, v := range updates {
			lines = append(lines, k+"="+v)
		}
		return os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600)
	}
	lines := strings.Split(string(b), "\n")
	seen := map[string]bool{}
	for i := range lines {
		line := lines[i]
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, _, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(k)
		if v, ok := updates[k]; ok {
			lines[i] = k + "=" + v
			seen[k] = true
		}
	}
	for k, v := range updates {
		if !seen[k] {
			lines = append(lines, k+"="+v)
		}
	}
	out := strings.Join(lines, "\n")
	if !strings.HasSuffix(out, "\n") {
		out += "\n"
	}
	return os.WriteFile(path, []byte(out), 0o600)
}

func selfUpdate(ctx context.Context, installDir, repoDir, opencelBin string, logf func(string)) error {
	// Minimal self-update: pull repo and rebuild via compose.
	// Note: Updating the host opencel CLI is handled by external update timer for now.
	if repoDir != "" {
		logf("git fetch/pull in " + repoDir)
		if err := runCmd(ctx, logf, "git", "-C", repoDir, "fetch", "--all", "--prune"); err != nil {
			return err
		}
		_ = runCmd(ctx, logf, "git", "-C", repoDir, "pull", "--ff-only")
	} else {
		logf("no repo dir mounted; skipping git pull")
	}

	// Apply via installer to rebuild images and ensure stack is running.
	if fi, err := os.Stat(opencelBin); err == nil && (fi.Mode()&0o111) != 0 && repoDir != "" {
		args := []string{"install", "--local-build", "--non-interactive", "--repo", repoDir, "--dir", installDir, "--tls", "letsencrypt"}
		logf("exec: " + opencelBin + " " + strings.Join(args, " "))
		return runCmd(ctx, logf, opencelBin, args...)
	}
	logf("installer not available; running docker compose up -d")
	return runCmd(ctx, logf, "docker", "compose", "-f", installDir+"/docker-compose.yml", "up", "-d")
}

func runCmd(ctx context.Context, logf func(string), exe string, args ...string) error {
	c := exec.CommandContext(ctx, exe, args...)
	c.Stdout = &logWriter{logf: logf}
	c.Stderr = &logWriter{logf: logf}
	// Prevent tasks from hanging forever.
	timer := time.AfterFunc(30*time.Minute, func() {
		_ = c.Process.Kill()
	})
	defer timer.Stop()
	return c.Run()
}

type logWriter struct {
	logf func(string)
	buf  []byte
}

func (w *logWriter) Write(p []byte) (int, error) {
	w.buf = append(w.buf, p...)
	for {
		i := bytes.IndexByte(w.buf, '\n')
		if i < 0 {
			break
		}
		line := string(w.buf[:i])
		w.logf(line)
		w.buf = w.buf[i+1:]
	}
	return len(p), nil
}
