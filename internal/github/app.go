package github

import (
	"bytes"
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type App struct {
	AppID          int64
	PrivateKey     *rsa.PrivateKey
	WebhookSecret  string
	HTTP           *http.Client
}

func NewApp(appID string, privateKeyPEM string, webhookSecret string) (*App, error) {
	id, err := strconv.ParseInt(strings.TrimSpace(appID), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("parse github app id: %w", err)
	}
	key, err := parseRSAPrivateKeyFromPEM(privateKeyPEM)
	if err != nil {
		return nil, err
	}
	return &App{
		AppID:         id,
		PrivateKey:    key,
		WebhookSecret: webhookSecret,
		HTTP:          &http.Client{Timeout: 30 * time.Second},
	}, nil
}

func parseRSAPrivateKeyFromPEM(pemStr string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, fmt.Errorf("invalid PEM")
	}
	// GitHub app keys are typically PKCS#1.
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	// Some keys might be PKCS#8.
	k, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse private key: %w", err)
	}
	rsaKey, ok := k.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("private key is not RSA")
	}
	return rsaKey, nil
}

func (a *App) AppJWT() (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"iat": now.Add(-30 * time.Second).Unix(),
		"exp": now.Add(8 * time.Minute).Unix(),
		"iss": a.AppID,
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return tok.SignedString(a.PrivateKey)
}

type InstallationResponse struct {
	ID int64 `json:"id"`
}

func (a *App) GetRepoInstallation(ctx context.Context, owner, repo string) (*InstallationResponse, error) {
	j, err := a.AppJWT()
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://api.github.com/repos/%s/%s/installation", owner, repo), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+j)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	res, err := a.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 8192))
		return nil, fmt.Errorf("github get installation: %s: %s", res.Status, strings.TrimSpace(string(b)))
	}
	var out InstallationResponse
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}

type RepoResponse struct {
	DefaultBranch string `json:"default_branch"`
	FullName      string `json:"full_name"`
}

func (a *App) GetRepo(ctx context.Context, token, owner, repo string) (*RepoResponse, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://api.github.com/repos/%s/%s", owner, repo), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	res, err := a.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 8192))
		return nil, fmt.Errorf("github get repo: %s: %s", res.Status, strings.TrimSpace(string(b)))
	}
	var out RepoResponse
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, err
	}
	return &out, nil
}

type tokenResp struct {
	Token string `json:"token"`
}

func (a *App) CreateInstallationToken(ctx context.Context, installationID int64) (string, error) {
	j, err := a.AppJWT()
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", fmt.Sprintf("https://api.github.com/app/installations/%d/access_tokens", installationID), bytes.NewReader([]byte("{}")))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+j)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("Content-Type", "application/json")
	res, err := a.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 8192))
		return "", fmt.Errorf("github create installation token: %s: %s", res.Status, strings.TrimSpace(string(b)))
	}
	var out tokenResp
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return "", err
	}
	return out.Token, nil
}

func (a *App) DownloadZipball(ctx context.Context, token, owner, repo, ref string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("https://api.github.com/repos/%s/%s/zipball/%s", owner, repo, ref), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	res, err := a.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(res.Body, 8192))
		return nil, fmt.Errorf("github download zipball: %s: %s", res.Status, strings.TrimSpace(string(b)))
	}
	return io.ReadAll(res.Body)
}

