package integrations

import (
	"context"
	"sync"
	"time"

	"github.com/opencel/opencel/internal/config"
	"github.com/opencel/opencel/internal/github"
	"github.com/opencel/opencel/internal/settings"
)

const (
	KeyGitHubAppID         = "github_app_id"
	KeyGitHubWebhookSecret = "github_app_webhook_secret"
	KeyGitHubPrivateKeyPEM = "github_app_private_key_pem"
)

type GitHubAppProvider struct {
	Cfg      *config.Config
	Settings *settings.Store

	mu       sync.Mutex
	lastLoad time.Time
	lastApp  *github.App
	lastCfgd bool
	lastErr  error
}

func NewGitHubAppProvider(cfg *config.Config, st *settings.Store) *GitHubAppProvider {
	return &GitHubAppProvider{Cfg: cfg, Settings: st}
}

// Get returns the configured GitHub App client.
// Falls back to environment variables when DB settings are not configured.
func (p *GitHubAppProvider) Get(ctx context.Context) (*github.App, bool, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if time.Since(p.lastLoad) < 30*time.Second && p.lastLoad.After(time.Time{}) {
		return p.lastApp, p.lastCfgd, p.lastErr
	}
	p.lastLoad = time.Now()

	appID := ""
	webhookSecret := ""
	privateKey := ""

	// DB settings take precedence (if present/configured).
	if p.Settings != nil {
		var tmp struct {
			AppID string `json:"app_id"`
		}
		if ok, _ := p.Settings.GetJSON(ctx, KeyGitHubAppID, &tmp); ok && tmp.AppID != "" {
			appID = tmp.AppID
		}
		if sec, ok, _ := p.Settings.GetSecret(ctx, KeyGitHubWebhookSecret); ok {
			webhookSecret = string(sec)
		}
		if sec, ok, _ := p.Settings.GetSecret(ctx, KeyGitHubPrivateKeyPEM); ok {
			privateKey = string(sec)
		}
	}

	// Env fallback for backwards compatibility.
	if appID == "" {
		appID = p.Cfg.GitHubAppID
	}
	if webhookSecret == "" {
		webhookSecret = p.Cfg.GitHubWebhookSecret
	}
	if privateKey == "" {
		privateKey = p.Cfg.GitHubPrivateKeyPEM
	}

	cfgd := appID != "" && webhookSecret != "" && privateKey != ""
	if !cfgd {
		p.lastApp = nil
		p.lastCfgd = false
		p.lastErr = nil
		return nil, false, nil
	}
	app, err := github.NewApp(appID, privateKey, webhookSecret)
	p.lastApp = app
	p.lastCfgd = err == nil
	p.lastErr = err
	return app, p.lastCfgd, p.lastErr
}

func (p *GitHubAppProvider) Invalidate() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.lastLoad = time.Time{}
	p.lastApp = nil
	p.lastErr = nil
	p.lastCfgd = false
}
