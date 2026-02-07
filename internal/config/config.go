package config

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"
)

type Config struct {
	// Core
	HTTPAddr   string
	DSN        string
	RedisAddr  string
	BaseDomain string

	// Secrets
	JWTSecret    string
	EnvKeyB64    string // 32 bytes base64
	EncryptKey   []byte

	// GitHub App
	GitHubAppID          string
	GitHubWebhookSecret  string
	GitHubPrivateKeyPEM  string
	GitHubPrivateKeyPath string

	// Optional bootstrap (first admin)
	BootstrapEmail    string
	BootstrapPassword string

	// Traefik file provider dynamic config path (mounted volume)
	TraefikDynamicPath string
	TraefikEntrypoint  string
	TraefikTLS         bool

	// Docker
	DockerNetwork string
	RegistryAddr  string // e.g. localhost:5000
}

func FromEnv() (*Config, error) {
	c := &Config{
		HTTPAddr:           envOr("OPENCEL_HTTP_ADDR", ":8080"),
		DSN:                os.Getenv("OPENCEL_DSN"),
		RedisAddr:          envOr("OPENCEL_REDIS_ADDR", "localhost:6379"),
		BaseDomain:         envOr("OPENCEL_BASE_DOMAIN", "opencel.localhost"),
		JWTSecret:          os.Getenv("OPENCEL_JWT_SECRET"),
		EnvKeyB64:          os.Getenv("OPENCEL_ENV_KEY_B64"),
		GitHubAppID:        os.Getenv("OPENCEL_GITHUB_APP_ID"),
		GitHubWebhookSecret: os.Getenv("OPENCEL_GITHUB_WEBHOOK_SECRET"),
		GitHubPrivateKeyPEM: os.Getenv("OPENCEL_GITHUB_PRIVATE_KEY_PEM"),
		GitHubPrivateKeyPath: os.Getenv("OPENCEL_GITHUB_PRIVATE_KEY_PATH"),
		BootstrapEmail:     os.Getenv("OPENCEL_BOOTSTRAP_EMAIL"),
		BootstrapPassword:  os.Getenv("OPENCEL_BOOTSTRAP_PASSWORD"),
		TraefikDynamicPath: envOr("OPENCEL_TRAEFIK_DYNAMIC_PATH", "/traefik/dynamic/opencel.yml"),
		TraefikEntrypoint:  envOr("OPENCEL_TRAEFIK_ENTRYPOINT", "websecure"),
		TraefikTLS:         envBool("OPENCEL_TRAEFIK_TLS", true),
		DockerNetwork:      envOr("OPENCEL_DOCKER_NETWORK", "opencel"),
		RegistryAddr:       envOr("OPENCEL_REGISTRY_ADDR", "localhost:5000"),
	}

	var missing []string
	if c.DSN == "" {
		missing = append(missing, "OPENCEL_DSN")
	}
	if c.JWTSecret == "" {
		// Generate an ephemeral secret for dev if not provided.
		c.JWTSecret = randomB64(32)
	}
	if c.EnvKeyB64 == "" {
		c.EnvKeyB64 = randomB64(32)
	}
	key, err := base64.StdEncoding.DecodeString(c.EnvKeyB64)
	if err != nil || len(key) != 32 {
		return nil, fmt.Errorf("OPENCEL_ENV_KEY_B64 must be base64 for 32 bytes: %w", err)
	}
	c.EncryptKey = key

	// GitHub config is required only if using GitHub features.
	// We don't hard-fail here so local dev can run without it.
	if c.GitHubPrivateKeyPEM == "" && c.GitHubPrivateKeyPath != "" {
		b, err := os.ReadFile(c.GitHubPrivateKeyPath)
		if err != nil {
			// Only fail if GitHub is configured (otherwise allow the system to run without GitHub support).
			if c.GitHubAppID != "" || c.GitHubWebhookSecret != "" {
				return nil, fmt.Errorf("read OPENCEL_GITHUB_PRIVATE_KEY_PATH: %w", err)
			}
		} else {
			c.GitHubPrivateKeyPEM = string(b)
		}
	}

	if len(missing) > 0 {
		return nil, errors.New("missing required env vars: " + strings.Join(missing, ", "))
	}
	return c, nil
}

func envOr(k, def string) string {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	return v
}

func envBool(k string, def bool) bool {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		return def
	}
	switch strings.ToLower(v) {
	case "1", "true", "t", "yes", "y", "on":
		return true
	case "0", "false", "f", "no", "n", "off":
		return false
	default:
		return def
	}
}

func randomB64(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.StdEncoding.EncodeToString(b)
}
