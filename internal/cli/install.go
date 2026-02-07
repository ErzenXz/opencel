package cli

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

func newInstallCmd() *cobra.Command {
	var installDir string
	var localBuild bool
	var tlsMode string
	var repoDir string
	var baseDomain string
	var acmeEmail string
	var adminEmail string
	var adminPassword string
	var ghAppID string
	var ghWebhookSecret string
	var ghKeyPath string
	var nonInteractive bool
	var imageRepo string
	cmd := &cobra.Command{
		Use:   "install",
		Short: "Interactive installer (Compose-first)",
		RunE: func(cmd *cobra.Command, args []string) error {
			in := bufio.NewReader(cmd.InOrStdin())
			out := cmd.OutOrStdout()

			if installDir == "" {
				installDir = "/opt/opencel"
			}

			fmt.Fprintln(out, "OpenCel installer (v1)")
			fmt.Fprintln(out, "")

			if !nonInteractive {
				installDir = prompt(in, out, "Install directory", installDir)
			}
			if baseDomain == "" {
				if nonInteractive {
					return fmt.Errorf("--base-domain is required with --non-interactive")
				}
				baseDomain = prompt(in, out, "Base domain (e.g. opencel.example.com)", "opencel.example.com")
			}
			if tlsMode == "" {
				if nonInteractive {
					tlsMode = "cloudflare"
				} else {
					tlsMode = prompt(in, out, "TLS mode (letsencrypt|cloudflare)", "cloudflare")
				}
			}
			if tlsMode == "letsencrypt" {
				if acmeEmail == "" {
					if nonInteractive {
						return fmt.Errorf("--acme-email is required when --tls letsencrypt")
					}
					acmeEmail = prompt(in, out, "ACME email (Let's Encrypt)", "admin@example.com")
				}
			}

			if adminEmail == "" {
				if nonInteractive {
					return fmt.Errorf("--admin-email is required with --non-interactive")
				}
				adminEmail = prompt(in, out, "Admin email", "admin@example.com")
			}
			if adminPassword == "" {
				if nonInteractive {
					return fmt.Errorf("--admin-password is required with --non-interactive")
				}
				adminPassword = promptSecret(in, out, "Admin password (input will be visible in this scaffold)", "")
			}

			fmt.Fprintln(out, "")
			if !nonInteractive {
				fmt.Fprintln(out, "GitHub App configuration (can be left blank for now, but GitHub deploys won't work):")
				if ghAppID == "" {
					ghAppID = prompt(in, out, "GitHub App ID", "")
				}
				if ghWebhookSecret == "" {
					ghWebhookSecret = prompt(in, out, "GitHub Webhook Secret", "")
				}
				if ghKeyPath == "" {
					ghKeyPath = prompt(in, out, "GitHub App private key PEM file path", "")
				}
			}

			fmt.Fprintln(out, "")
			fmt.Fprintf(out, "DNS requirements:\n- %s\n- *.preview.%s\n- *.prod.%s\n", baseDomain, baseDomain, baseDomain)
			if !nonInteractive {
				_ = prompt(in, out, "Type 'ok' once DNS is configured (or press enter to continue)", "ok")
			}

			if err := os.MkdirAll(installDir, 0o755); err != nil {
				return err
			}
			if err := os.MkdirAll(filepath.Join(installDir, "traefik", "dynamic"), 0o755); err != nil {
				return err
			}
			if err := os.MkdirAll(filepath.Join(installDir, ".data"), 0o755); err != nil {
				return err
			}
			if err := os.MkdirAll(filepath.Join(installDir, "secrets"), 0o755); err != nil {
				return err
			}

			// Copy github key if provided.
			if ghKeyPath != "" {
				b, err := os.ReadFile(ghKeyPath)
				if err != nil {
					return fmt.Errorf("read github key: %w", err)
				}
				if err := os.WriteFile(filepath.Join(installDir, "secrets", "github_app_private_key.pem"), b, 0o600); err != nil {
					return fmt.Errorf("write github key: %w", err)
				}
			} else {
				// Ensure file exists to satisfy compose mounts.
				_ = os.WriteFile(filepath.Join(installDir, "secrets", "github_app_private_key.pem"), []byte(""), 0o600)
			}

			pgPass := randB64(24)
			jwtSecret := randB64(48)
			envKey := randB64(32)

			env := new(bytes.Buffer)
			fmt.Fprintf(env, "OPENCEL_BASE_DOMAIN=%s\n", baseDomain)
			fmt.Fprintf(env, "OPENCEL_ACME_EMAIL=%s\n", acmeEmail)
			if imageRepo == "" {
				imageRepo = "ghcr.io/opencel"
			}
			fmt.Fprintf(env, "OPENCEL_IMAGE_REPO=%s\n", imageRepo)
			fmt.Fprintf(env, "OPENCEL_PG_USER=opencel\n")
			fmt.Fprintf(env, "OPENCEL_PG_PASSWORD=%s\n", pgPass)
			fmt.Fprintf(env, "OPENCEL_PG_DB=opencel\n")
			fmt.Fprintf(env, "OPENCEL_DSN=postgres://opencel:%s@postgres:5432/opencel?sslmode=disable\n", pgPass)
			fmt.Fprintf(env, "OPENCEL_JWT_SECRET=%s\n", jwtSecret)
			fmt.Fprintf(env, "OPENCEL_ENV_KEY_B64=%s\n", envKey)
			fmt.Fprintf(env, "OPENCEL_BOOTSTRAP_EMAIL=%s\n", adminEmail)
			fmt.Fprintf(env, "OPENCEL_BOOTSTRAP_PASSWORD=%s\n", adminPassword)
			fmt.Fprintf(env, "OPENCEL_GITHUB_APP_ID=%s\n", ghAppID)
			fmt.Fprintf(env, "OPENCEL_GITHUB_WEBHOOK_SECRET=%s\n", ghWebhookSecret)
			if tlsMode == "cloudflare" {
				fmt.Fprintf(env, "OPENCEL_TRAEFIK_ENTRYPOINT=web\n")
				fmt.Fprintf(env, "OPENCEL_TRAEFIK_TLS=false\n")
			} else {
				fmt.Fprintf(env, "OPENCEL_TRAEFIK_ENTRYPOINT=websecure\n")
				fmt.Fprintf(env, "OPENCEL_TRAEFIK_TLS=true\n")
			}
			if localBuild {
				if repoDir == "" {
					wd, _ := os.Getwd()
					repoDir = wd
				}
				fmt.Fprintf(env, "OPENCEL_REPO_DIR=%s\n", repoDir)
			}

			if err := os.WriteFile(filepath.Join(installDir, ".env"), env.Bytes(), 0o600); err != nil {
				return err
			}

			composePath := filepath.Join(installDir, "docker-compose.yml")
			if localBuild {
				// For contributors running from a repo checkout: keep build contexts pointing at OPENCEL_REPO_DIR.
				if tlsMode == "cloudflare" {
					if err := os.WriteFile(composePath, []byte(localBuildComposeCloudflare), 0o644); err != nil {
						return err
					}
				} else {
					if err := os.WriteFile(composePath, []byte(localBuildComposeLetsEncrypt), 0o644); err != nil {
						return err
					}
				}
			} else {
				if tlsMode == "cloudflare" {
					if err := os.WriteFile(composePath, []byte(releaseComposeCloudflare), 0o644); err != nil {
						return err
					}
				} else {
					if err := os.WriteFile(composePath, []byte(releaseComposeYML), 0o644); err != nil {
						return err
					}
				}
			}

			// Seed dynamic config file for prod aliases.
			_ = os.WriteFile(filepath.Join(installDir, "traefik", "dynamic", "opencel.yml"), []byte("http:\n  routers: {}\n  services: {}\n"), 0o644)

			fmt.Fprintln(out, "")
			fmt.Fprintln(out, "Starting services with Docker Compose...")
			if err := run(cmd, installDir, "docker", "compose", "up", "-d"); err != nil {
				return err
			}

			fmt.Fprintln(out, "")
			fmt.Fprintf(out, "OpenCel is starting.\nDashboard: https://%s\n", baseDomain)
			fmt.Fprintln(out, "Next: open the dashboard and login with the admin email/password you set.")
			return nil
		},
	}
	cmd.Flags().StringVar(&installDir, "dir", "", "Install directory (default /opt/opencel)")
	cmd.Flags().BoolVar(&localBuild, "local-build", false, "Use repo-local compose file with build contexts")
	cmd.Flags().StringVar(&repoDir, "repo", "", "Repo directory (used with --local-build)")
	cmd.Flags().StringVar(&tlsMode, "tls", "", "TLS mode: letsencrypt or cloudflare")
	cmd.Flags().StringVar(&baseDomain, "base-domain", "", "Base domain (e.g. opencel.example.com)")
	cmd.Flags().StringVar(&acmeEmail, "acme-email", "", "ACME email (Let's Encrypt)")
	cmd.Flags().StringVar(&adminEmail, "admin-email", "", "Admin email (bootstrapped on first start)")
	cmd.Flags().StringVar(&adminPassword, "admin-password", "", "Admin password (bootstrapped on first start)")
	cmd.Flags().StringVar(&ghAppID, "github-app-id", "", "GitHub App ID")
	cmd.Flags().StringVar(&ghWebhookSecret, "github-webhook-secret", "", "GitHub webhook secret")
	cmd.Flags().StringVar(&ghKeyPath, "github-key", "", "GitHub App private key PEM file path")
	cmd.Flags().BoolVar(&nonInteractive, "non-interactive", false, "Fail instead of prompting; requires flags")
	cmd.Flags().StringVar(&imageRepo, "image-repo", "", "Container registry/repo prefix (default ghcr.io/opencel)")
	return cmd
}

func prompt(in *bufio.Reader, out io.Writer, label, def string) string {
	fmt.Fprintf(out, "%s [%s]: ", label, def)
	s, _ := in.ReadString('\n')
	s = strings.TrimSpace(s)
	if s == "" {
		return def
	}
	return s
}

func promptSecret(in *bufio.Reader, out io.Writer, label, def string) string {
	// Scaffold: no terminal masking. Replace later with proper TTY masking.
	fmt.Fprintf(out, "%s [%s]: ", label, def)
	s, _ := in.ReadString('\n')
	s = strings.TrimSpace(s)
	if s == "" {
		return def
	}
	return s
}

func randB64(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.StdEncoding.EncodeToString(b)
}

func run(cmd *cobra.Command, dir string, name string, args ...string) error {
	c := exec.Command(name, args...)
	c.Dir = dir
	c.Stdout = cmd.OutOrStdout()
	c.Stderr = cmd.ErrOrStderr()
	return c.Run()
}

func copyFile(src, dst string) error {
	b, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, b, 0o644)
}

const releaseComposeYML = `name: opencel

services:
  traefik:
    image: traefik:v3
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.file.filename=/traefik/dynamic/opencel.yml"
      - "--providers.file.watch=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--api.dashboard=true"
      - "--accesslog=true"
      - "--log.level=INFO"
      - "--certificatesresolvers.le.acme.httpchallenge=true"
      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.le.acme.storage=/traefik/acme/acme.json"
      - "--certificatesresolvers.le.acme.email=${OPENCEL_ACME_EMAIL}"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/dynamic:/traefik/dynamic
      - ./.data/traefik/acme:/traefik/acme
    networks: [opencel]

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${OPENCEL_PG_USER:-opencel}
      POSTGRES_PASSWORD: ${OPENCEL_PG_PASSWORD:-opencel}
      POSTGRES_DB: ${OPENCEL_PG_DB:-opencel}
    volumes:
      - ./.data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${OPENCEL_PG_USER:-opencel} -d ${OPENCEL_PG_DB:-opencel}"]
      interval: 5s
      timeout: 3s
      retries: 30
    networks: [opencel]

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 30
    networks: [opencel]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${OPENCEL_MINIO_USER:-opencel}
      MINIO_ROOT_PASSWORD: ${OPENCEL_MINIO_PASSWORD:-opencel-opencel}
    volumes:
      - ./.data/minio:/data
    networks: [opencel]

  registry:
    image: registry:2
    ports:
      - "5000:5000"
    volumes:
      - ./.data/registry:/var/lib/registry
    networks: [opencel]

  api:
    image: ${OPENCEL_IMAGE_REPO}/opencel-api:latest
    environment:
      OPENCEL_HTTP_ADDR: ":8080"
      OPENCEL_DSN: ${OPENCEL_DSN}
      OPENCEL_REDIS_ADDR: "redis:6379"
      OPENCEL_BASE_DOMAIN: ${OPENCEL_BASE_DOMAIN}
      OPENCEL_JWT_SECRET: ${OPENCEL_JWT_SECRET}
      OPENCEL_ENV_KEY_B64: ${OPENCEL_ENV_KEY_B64}
      OPENCEL_GITHUB_APP_ID: ${OPENCEL_GITHUB_APP_ID}
      OPENCEL_GITHUB_WEBHOOK_SECRET: ${OPENCEL_GITHUB_WEBHOOK_SECRET}
      OPENCEL_GITHUB_PRIVATE_KEY_PATH: "/secrets/github_app_private_key.pem"
      OPENCEL_BOOTSTRAP_EMAIL: ${OPENCEL_BOOTSTRAP_EMAIL}
      OPENCEL_BOOTSTRAP_PASSWORD: ${OPENCEL_BOOTSTRAP_PASSWORD}
      OPENCEL_TRAEFIK_DYNAMIC_PATH: "/traefik/dynamic/opencel.yml"
      OPENCEL_DOCKER_NETWORK: "opencel"
      OPENCEL_REGISTRY_ADDR: "localhost:5000"
    volumes:
      - ./traefik/dynamic:/traefik/dynamic
      - ./secrets:/secrets:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opencel-api.rule=Host(\"${OPENCEL_BASE_DOMAIN}\") && PathPrefix(\"/api\")"
      - "traefik.http.routers.opencel-api.entrypoints=websecure"
      - "traefik.http.routers.opencel-api.tls.certresolver=le"
      - "traefik.http.services.opencel-api.loadbalancer.server.port=8080"
    networks: [opencel]

  worker:
    image: ${OPENCEL_IMAGE_REPO}/opencel-worker:latest
    environment:
      OPENCEL_DSN: ${OPENCEL_DSN}
      OPENCEL_REDIS_ADDR: "redis:6379"
      OPENCEL_BASE_DOMAIN: ${OPENCEL_BASE_DOMAIN}
      OPENCEL_ENV_KEY_B64: ${OPENCEL_ENV_KEY_B64}
      OPENCEL_GITHUB_APP_ID: ${OPENCEL_GITHUB_APP_ID}
      OPENCEL_GITHUB_WEBHOOK_SECRET: ${OPENCEL_GITHUB_WEBHOOK_SECRET}
      OPENCEL_GITHUB_PRIVATE_KEY_PATH: "/secrets/github_app_private_key.pem"
      OPENCEL_DOCKER_NETWORK: "opencel"
      OPENCEL_REGISTRY_ADDR: "localhost:5000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./secrets:/secrets:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      registry:
        condition: service_started
    networks: [opencel]

  web:
    image: ${OPENCEL_IMAGE_REPO}/opencel-web:latest
    depends_on:
      api:
        condition: service_started
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opencel-web.rule=Host(\"${OPENCEL_BASE_DOMAIN}\")"
      - "traefik.http.routers.opencel-web.entrypoints=websecure"
      - "traefik.http.routers.opencel-web.tls.certresolver=le"
      - "traefik.http.services.opencel-web.loadbalancer.server.port=3000"
    networks: [opencel]

networks:
  opencel:
    name: opencel
`

const releaseComposeCloudflare = `name: opencel

services:
  traefik:
    image: traefik:v3
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.file.filename=/traefik/dynamic/opencel.yml"
      - "--providers.file.watch=true"
      - "--entrypoints.web.address=:80"
      - "--api.dashboard=true"
      - "--accesslog=true"
      - "--log.level=INFO"
    ports:
      - "80:80"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/dynamic:/traefik/dynamic
    networks: [opencel]

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${OPENCEL_PG_USER:-opencel}
      POSTGRES_PASSWORD: ${OPENCEL_PG_PASSWORD:-opencel}
      POSTGRES_DB: ${OPENCEL_PG_DB:-opencel}
    volumes:
      - ./.data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${OPENCEL_PG_USER:-opencel} -d ${OPENCEL_PG_DB:-opencel}"]
      interval: 5s
      timeout: 3s
      retries: 30
    networks: [opencel]

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 30
    networks: [opencel]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${OPENCEL_MINIO_USER:-opencel}
      MINIO_ROOT_PASSWORD: ${OPENCEL_MINIO_PASSWORD:-opencel-opencel}
    volumes:
      - ./.data/minio:/data
    networks: [opencel]

  registry:
    image: registry:2
    ports:
      - "5000:5000"
    volumes:
      - ./.data/registry:/var/lib/registry
    networks: [opencel]

  api:
    image: ${OPENCEL_IMAGE_REPO}/opencel-api:latest
    environment:
      OPENCEL_HTTP_ADDR: ":8080"
      OPENCEL_DSN: ${OPENCEL_DSN}
      OPENCEL_REDIS_ADDR: "redis:6379"
      OPENCEL_BASE_DOMAIN: ${OPENCEL_BASE_DOMAIN}
      OPENCEL_JWT_SECRET: ${OPENCEL_JWT_SECRET}
      OPENCEL_ENV_KEY_B64: ${OPENCEL_ENV_KEY_B64}
      OPENCEL_GITHUB_APP_ID: ${OPENCEL_GITHUB_APP_ID}
      OPENCEL_GITHUB_WEBHOOK_SECRET: ${OPENCEL_GITHUB_WEBHOOK_SECRET}
      OPENCEL_GITHUB_PRIVATE_KEY_PATH: "/secrets/github_app_private_key.pem"
      OPENCEL_BOOTSTRAP_EMAIL: ${OPENCEL_BOOTSTRAP_EMAIL}
      OPENCEL_BOOTSTRAP_PASSWORD: ${OPENCEL_BOOTSTRAP_PASSWORD}
      OPENCEL_TRAEFIK_DYNAMIC_PATH: "/traefik/dynamic/opencel.yml"
      OPENCEL_DOCKER_NETWORK: "opencel"
      OPENCEL_REGISTRY_ADDR: "localhost:5000"
      OPENCEL_TRAEFIK_ENTRYPOINT: "web"
      OPENCEL_TRAEFIK_TLS: "false"
    volumes:
      - ./traefik/dynamic:/traefik/dynamic
      - ./secrets:/secrets:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opencel-api.rule=Host(\"${OPENCEL_BASE_DOMAIN}\") && PathPrefix(\"/api\")"
      - "traefik.http.routers.opencel-api.entrypoints=web"
      - "traefik.http.services.opencel-api.loadbalancer.server.port=8080"
    networks: [opencel]

  worker:
    image: ${OPENCEL_IMAGE_REPO}/opencel-worker:latest
    environment:
      OPENCEL_DSN: ${OPENCEL_DSN}
      OPENCEL_REDIS_ADDR: "redis:6379"
      OPENCEL_BASE_DOMAIN: ${OPENCEL_BASE_DOMAIN}
      OPENCEL_ENV_KEY_B64: ${OPENCEL_ENV_KEY_B64}
      OPENCEL_GITHUB_APP_ID: ${OPENCEL_GITHUB_APP_ID}
      OPENCEL_GITHUB_WEBHOOK_SECRET: ${OPENCEL_GITHUB_WEBHOOK_SECRET}
      OPENCEL_GITHUB_PRIVATE_KEY_PATH: "/secrets/github_app_private_key.pem"
      OPENCEL_DOCKER_NETWORK: "opencel"
      OPENCEL_REGISTRY_ADDR: "localhost:5000"
      OPENCEL_TRAEFIK_ENTRYPOINT: "web"
      OPENCEL_TRAEFIK_TLS: "false"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./secrets:/secrets:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      registry:
        condition: service_started
    networks: [opencel]

  web:
    image: ${OPENCEL_IMAGE_REPO}/opencel-web:latest
    depends_on:
      api:
        condition: service_started
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opencel-web.rule=Host(\"${OPENCEL_BASE_DOMAIN}\")"
      - "traefik.http.routers.opencel-web.entrypoints=web"
      - "traefik.http.services.opencel-web.loadbalancer.server.port=3000"
    networks: [opencel]

networks:
  opencel:
    name: opencel
`

const localBuildComposeLetsEncrypt = `name: opencel

services:
  traefik:
    image: traefik:v3
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.file.filename=/traefik/dynamic/opencel.yml"
      - "--providers.file.watch=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--api.dashboard=true"
      - "--accesslog=true"
      - "--log.level=INFO"
      - "--certificatesresolvers.le.acme.httpchallenge=true"
      - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.le.acme.storage=/traefik/acme/acme.json"
      - "--certificatesresolvers.le.acme.email=${OPENCEL_ACME_EMAIL}"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/dynamic:/traefik/dynamic
      - ./.data/traefik/acme:/traefik/acme
    networks: [opencel]

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${OPENCEL_PG_USER:-opencel}
      POSTGRES_PASSWORD: ${OPENCEL_PG_PASSWORD:-opencel}
      POSTGRES_DB: ${OPENCEL_PG_DB:-opencel}
    volumes:
      - ./.data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${OPENCEL_PG_USER:-opencel} -d ${OPENCEL_PG_DB:-opencel}"]
      interval: 5s
      timeout: 3s
      retries: 30
    networks: [opencel]

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 30
    networks: [opencel]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${OPENCEL_MINIO_USER:-opencel}
      MINIO_ROOT_PASSWORD: ${OPENCEL_MINIO_PASSWORD:-opencel-opencel}
    volumes:
      - ./.data/minio:/data
    networks: [opencel]

  registry:
    image: registry:2
    ports:
      - "5000:5000"
    volumes:
      - ./.data/registry:/var/lib/registry
    networks: [opencel]

  api:
    build:
      context: ${OPENCEL_REPO_DIR}
      dockerfile: ${OPENCEL_REPO_DIR}/deploy/compose/Dockerfile.api
    environment:
      OPENCEL_HTTP_ADDR: ":8080"
      OPENCEL_DSN: ${OPENCEL_DSN}
      OPENCEL_REDIS_ADDR: "redis:6379"
      OPENCEL_BASE_DOMAIN: ${OPENCEL_BASE_DOMAIN}
      OPENCEL_JWT_SECRET: ${OPENCEL_JWT_SECRET}
      OPENCEL_ENV_KEY_B64: ${OPENCEL_ENV_KEY_B64}
      OPENCEL_GITHUB_APP_ID: ${OPENCEL_GITHUB_APP_ID}
      OPENCEL_GITHUB_WEBHOOK_SECRET: ${OPENCEL_GITHUB_WEBHOOK_SECRET}
      OPENCEL_GITHUB_PRIVATE_KEY_PATH: "/secrets/github_app_private_key.pem"
      OPENCEL_BOOTSTRAP_EMAIL: ${OPENCEL_BOOTSTRAP_EMAIL}
      OPENCEL_BOOTSTRAP_PASSWORD: ${OPENCEL_BOOTSTRAP_PASSWORD}
      OPENCEL_TRAEFIK_DYNAMIC_PATH: "/traefik/dynamic/opencel.yml"
      OPENCEL_DOCKER_NETWORK: "opencel"
      OPENCEL_REGISTRY_ADDR: "localhost:5000"
      OPENCEL_TRAEFIK_ENTRYPOINT: "websecure"
      OPENCEL_TRAEFIK_TLS: "true"
    volumes:
      - ./traefik/dynamic:/traefik/dynamic
      - ./secrets:/secrets:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opencel-api.rule=Host(\"${OPENCEL_BASE_DOMAIN}\") && PathPrefix(\"/api\")"
      - "traefik.http.routers.opencel-api.entrypoints=websecure"
      - "traefik.http.routers.opencel-api.tls.certresolver=le"
      - "traefik.http.services.opencel-api.loadbalancer.server.port=8080"
    networks: [opencel]

  worker:
    build:
      context: ${OPENCEL_REPO_DIR}
      dockerfile: ${OPENCEL_REPO_DIR}/deploy/compose/Dockerfile.worker
    environment:
      OPENCEL_DSN: ${OPENCEL_DSN}
      OPENCEL_REDIS_ADDR: "redis:6379"
      OPENCEL_BASE_DOMAIN: ${OPENCEL_BASE_DOMAIN}
      OPENCEL_ENV_KEY_B64: ${OPENCEL_ENV_KEY_B64}
      OPENCEL_GITHUB_APP_ID: ${OPENCEL_GITHUB_APP_ID}
      OPENCEL_GITHUB_WEBHOOK_SECRET: ${OPENCEL_GITHUB_WEBHOOK_SECRET}
      OPENCEL_GITHUB_PRIVATE_KEY_PATH: "/secrets/github_app_private_key.pem"
      OPENCEL_DOCKER_NETWORK: "opencel"
      OPENCEL_REGISTRY_ADDR: "localhost:5000"
      OPENCEL_TRAEFIK_ENTRYPOINT: "websecure"
      OPENCEL_TRAEFIK_TLS: "true"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./secrets:/secrets:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      registry:
        condition: service_started
    networks: [opencel]

  web:
    build:
      context: ${OPENCEL_REPO_DIR}
      dockerfile: ${OPENCEL_REPO_DIR}/deploy/compose/Dockerfile.web
    depends_on:
      api:
        condition: service_started
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opencel-web.rule=Host(\"${OPENCEL_BASE_DOMAIN}\")"
      - "traefik.http.routers.opencel-web.entrypoints=websecure"
      - "traefik.http.routers.opencel-web.tls.certresolver=le"
      - "traefik.http.services.opencel-web.loadbalancer.server.port=3000"
    networks: [opencel]

networks:
  opencel:
    name: opencel
`

const localBuildComposeCloudflare = `name: opencel

services:
  traefik:
    image: traefik:v3
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.file.filename=/traefik/dynamic/opencel.yml"
      - "--providers.file.watch=true"
      - "--entrypoints.web.address=:80"
      - "--api.dashboard=true"
      - "--accesslog=true"
      - "--log.level=INFO"
    ports:
      - "80:80"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik/dynamic:/traefik/dynamic
    networks: [opencel]

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${OPENCEL_PG_USER:-opencel}
      POSTGRES_PASSWORD: ${OPENCEL_PG_PASSWORD:-opencel}
      POSTGRES_DB: ${OPENCEL_PG_DB:-opencel}
    volumes:
      - ./.data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${OPENCEL_PG_USER:-opencel} -d ${OPENCEL_PG_DB:-opencel}"]
      interval: 5s
      timeout: 3s
      retries: 30
    networks: [opencel]

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 30
    networks: [opencel]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${OPENCEL_MINIO_USER:-opencel}
      MINIO_ROOT_PASSWORD: ${OPENCEL_MINIO_PASSWORD:-opencel-opencel}
    volumes:
      - ./.data/minio:/data
    networks: [opencel]

  registry:
    image: registry:2
    ports:
      - "5000:5000"
    volumes:
      - ./.data/registry:/var/lib/registry
    networks: [opencel]

  api:
    build:
      context: ${OPENCEL_REPO_DIR}
      dockerfile: ${OPENCEL_REPO_DIR}/deploy/compose/Dockerfile.api
    environment:
      OPENCEL_HTTP_ADDR: ":8080"
      OPENCEL_DSN: ${OPENCEL_DSN}
      OPENCEL_REDIS_ADDR: "redis:6379"
      OPENCEL_BASE_DOMAIN: ${OPENCEL_BASE_DOMAIN}
      OPENCEL_JWT_SECRET: ${OPENCEL_JWT_SECRET}
      OPENCEL_ENV_KEY_B64: ${OPENCEL_ENV_KEY_B64}
      OPENCEL_GITHUB_APP_ID: ${OPENCEL_GITHUB_APP_ID}
      OPENCEL_GITHUB_WEBHOOK_SECRET: ${OPENCEL_GITHUB_WEBHOOK_SECRET}
      OPENCEL_GITHUB_PRIVATE_KEY_PATH: "/secrets/github_app_private_key.pem"
      OPENCEL_BOOTSTRAP_EMAIL: ${OPENCEL_BOOTSTRAP_EMAIL}
      OPENCEL_BOOTSTRAP_PASSWORD: ${OPENCEL_BOOTSTRAP_PASSWORD}
      OPENCEL_TRAEFIK_DYNAMIC_PATH: "/traefik/dynamic/opencel.yml"
      OPENCEL_DOCKER_NETWORK: "opencel"
      OPENCEL_REGISTRY_ADDR: "localhost:5000"
      OPENCEL_TRAEFIK_ENTRYPOINT: "web"
      OPENCEL_TRAEFIK_TLS: "false"
    volumes:
      - ./traefik/dynamic:/traefik/dynamic
      - ./secrets:/secrets:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opencel-api.rule=Host(\"${OPENCEL_BASE_DOMAIN}\") && PathPrefix(\"/api\")"
      - "traefik.http.routers.opencel-api.entrypoints=web"
      - "traefik.http.services.opencel-api.loadbalancer.server.port=8080"
    networks: [opencel]

  worker:
    build:
      context: ${OPENCEL_REPO_DIR}
      dockerfile: ${OPENCEL_REPO_DIR}/deploy/compose/Dockerfile.worker
    environment:
      OPENCEL_DSN: ${OPENCEL_DSN}
      OPENCEL_REDIS_ADDR: "redis:6379"
      OPENCEL_BASE_DOMAIN: ${OPENCEL_BASE_DOMAIN}
      OPENCEL_ENV_KEY_B64: ${OPENCEL_ENV_KEY_B64}
      OPENCEL_GITHUB_APP_ID: ${OPENCEL_GITHUB_APP_ID}
      OPENCEL_GITHUB_WEBHOOK_SECRET: ${OPENCEL_GITHUB_WEBHOOK_SECRET}
      OPENCEL_GITHUB_PRIVATE_KEY_PATH: "/secrets/github_app_private_key.pem"
      OPENCEL_DOCKER_NETWORK: "opencel"
      OPENCEL_REGISTRY_ADDR: "localhost:5000"
      OPENCEL_TRAEFIK_ENTRYPOINT: "web"
      OPENCEL_TRAEFIK_TLS: "false"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./secrets:/secrets:ro
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      registry:
        condition: service_started
    networks: [opencel]

  web:
    build:
      context: ${OPENCEL_REPO_DIR}
      dockerfile: ${OPENCEL_REPO_DIR}/deploy/compose/Dockerfile.web
    depends_on:
      api:
        condition: service_started
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.opencel-web.rule=Host(\"${OPENCEL_BASE_DOMAIN}\")"
      - "traefik.http.routers.opencel-web.entrypoints=web"
      - "traefik.http.services.opencel-web.loadbalancer.server.port=3000"
    networks: [opencel]

networks:
  opencel:
    name: opencel
`
