package api

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/opencel/opencel/internal/crypto/envcrypt"
	"github.com/opencel/opencel/internal/integrations"
	"golang.org/x/crypto/bcrypt"
)

const (
	ghStateCookie    = "opencel_gh_oauth_state"
	ghVerifierCookie = "opencel_gh_oauth_verifier"
	ghReturnCookie   = "opencel_gh_oauth_return_to"
)

func randB64URL(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func pkceChallenge(verifier string) string {
	h := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

func (s *Server) githubOAuthConfig(ctx context.Context) (clientID, clientSecret string, ok bool, _ error) {
	var v struct {
		ClientID string `json:"client_id"`
	}
	if got, err := s.Settings.GetJSON(ctx, integrations.KeyGitHubOAuthClientID, &v); err != nil {
		return "", "", false, err
	} else if got && strings.TrimSpace(v.ClientID) != "" {
		clientID = strings.TrimSpace(v.ClientID)
	}
	sec, secOK, err := s.Settings.GetSecret(ctx, integrations.KeyGitHubOAuthClientSecret)
	if err != nil {
		return "", "", false, err
	}
	if secOK {
		clientSecret = strings.TrimSpace(string(sec))
	}
	ok = clientID != "" && clientSecret != ""
	return clientID, clientSecret, ok, nil
}

func (s *Server) handleGitHubOAuthStatus(w http.ResponseWriter, r *http.Request) {
	clientID, _, ok, err := s.githubOAuthConfig(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "oauth config error"})
		return
	}
	writeJSON(w, 200, map[string]any{
		"configured": ok,
		"client_id":  clientID,
	})
}

func (s *Server) handleGitHubOAuthStart(w http.ResponseWriter, r *http.Request) {
	clientID, _, ok, err := s.githubOAuthConfig(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "oauth config error"})
		return
	}
	if !ok {
		writeJSON(w, 400, map[string]any{"error": "github oauth not configured"})
		return
	}

	returnTo := strings.TrimSpace(r.URL.Query().Get("return_to"))
	if returnTo == "" || !strings.HasPrefix(returnTo, "/") {
		returnTo = "/projects"
	}

	state := randB64URL(24)
	verifier := randB64URL(48)
	challenge := pkceChallenge(verifier)

	secure := isHTTPS(r)
	http.SetCookie(w, &http.Cookie{
		Name:     ghStateCookie,
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
		Expires:  time.Now().Add(10 * time.Minute),
	})
	http.SetCookie(w, &http.Cookie{
		Name:     ghVerifierCookie,
		Value:    verifier,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
		Expires:  time.Now().Add(10 * time.Minute),
	})
	http.SetCookie(w, &http.Cookie{
		Name:     ghReturnCookie,
		Value:    returnTo,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   secure,
		Expires:  time.Now().Add(10 * time.Minute),
	})

	scheme := "http"
	if isHTTPS(r) {
		scheme = "https"
	}
	redirectURI := fmt.Sprintf("%s://%s/api/auth/github/callback", scheme, r.Host)

	q := url.Values{}
	q.Set("client_id", clientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("state", state)
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")
	// Default scopes for repo discovery. Admin can reconfigure later if needed.
	q.Set("scope", "read:user repo")

	u := url.URL{
		Scheme:   "https",
		Host:     "github.com",
		Path:     "/login/oauth/authorize",
		RawQuery: q.Encode(),
	}
	http.Redirect(w, r, u.String(), http.StatusFound)
}

type ghTokenResp struct {
	AccessToken string `json:"access_token"`
	Scope       string `json:"scope"`
	TokenType   string `json:"token_type"`
}

type ghUserResp struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
}

func (s *Server) handleGitHubOAuthCallback(w http.ResponseWriter, r *http.Request) {
	clientID, clientSecret, ok, err := s.githubOAuthConfig(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "oauth config error"})
		return
	}
	if !ok {
		writeJSON(w, 400, map[string]any{"error": "github oauth not configured"})
		return
	}
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	if code == "" || state == "" {
		writeJSON(w, 400, map[string]any{"error": "missing code/state"})
		return
	}
	stateC, err := r.Cookie(ghStateCookie)
	if err != nil || stateC.Value == "" || stateC.Value != state {
		writeJSON(w, 400, map[string]any{"error": "invalid oauth state"})
		return
	}
	verC, err := r.Cookie(ghVerifierCookie)
	if err != nil || verC.Value == "" {
		writeJSON(w, 400, map[string]any{"error": "missing oauth verifier"})
		return
	}
	ret := "/projects"
	if rc, err := r.Cookie(ghReturnCookie); err == nil && strings.HasPrefix(rc.Value, "/") {
		ret = rc.Value
	}

	scheme := "http"
	if isHTTPS(r) {
		scheme = "https"
	}
	redirectURI := fmt.Sprintf("%s://%s/api/auth/github/callback", scheme, r.Host)

	form := url.Values{}
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("code_verifier", verC.Value)

	req, _ := http.NewRequestWithContext(r.Context(), "POST", "https://github.com/login/oauth/access_token", strings.NewReader(form.Encode()))
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		writeJSON(w, 502, map[string]any{"error": "github token exchange failed"})
		return
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		writeJSON(w, 502, map[string]any{"error": "github token exchange failed"})
		return
	}
	var tr ghTokenResp
	if err := json.Unmarshal(b, &tr); err != nil || tr.AccessToken == "" {
		writeJSON(w, 502, map[string]any{"error": "invalid token response"})
		return
	}

	// Fetch user identity.
	ureq, _ := http.NewRequestWithContext(r.Context(), "GET", "https://api.github.com/user", nil)
	ureq.Header.Set("Authorization", "token "+tr.AccessToken)
	ureq.Header.Set("Accept", "application/vnd.github+json")
	ures, err := http.DefaultClient.Do(ureq)
	if err != nil {
		writeJSON(w, 502, map[string]any{"error": "github user fetch failed"})
		return
	}
	defer ures.Body.Close()
	ub, _ := io.ReadAll(io.LimitReader(ures.Body, 1<<20))
	if ures.StatusCode < 200 || ures.StatusCode >= 300 {
		writeJSON(w, 502, map[string]any{"error": "github user fetch failed"})
		return
	}
	var gu ghUserResp
	if err := json.Unmarshal(ub, &gu); err != nil || gu.ID == 0 || gu.Login == "" {
		writeJSON(w, 502, map[string]any{"error": "invalid github user response"})
		return
	}

	// Determine current user (if already logged in).
	currentUID := ""
	if c, err := r.Cookie(authCookieName); err == nil && c.Value != "" {
		if uid, err := s.verifyJWT(c.Value); err == nil && uid != "" {
			currentUID = uid
		}
	}

	providerUserID := strconv.FormatInt(gu.ID, 10)
	ident, err := s.Store.GetUserIdentity(r.Context(), "github", providerUserID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "db error"})
		return
	}

	userID := currentUID
	if userID == "" {
		if ident != nil {
			userID = ident.UserID
		} else {
			// Create a new local user with a non-reusable password (GitHub login only).
			email := fmt.Sprintf("%s@users.noreply.github.com", gu.Login)
			pw := randB64URL(24)
			hash, _ := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
			u, err := s.Store.CreateUser(r.Context(), email, string(hash))
			if err != nil {
				writeJSON(w, 500, map[string]any{"error": "create user failed"})
				return
			}
			userID = u.ID
		}
	}

	// Link identity to user.
	if _, err := s.Store.UpsertUserIdentity(r.Context(), userID, "github", providerUserID, gu.Login); err != nil {
		writeJSON(w, 500, map[string]any{"error": "link identity failed"})
		return
	}

	// Store encrypted oauth token.
	enc, err := envcrypt.Encrypt(s.Cfg.EncryptKey, []byte(tr.AccessToken))
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "token encrypt failed"})
		return
	}
	_ = s.Store.UpsertGitHubOAuthToken(r.Context(), userID, enc, tr.Scope)

	// Log in user.
	tok, err := s.signJWT(userID)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "token error"})
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    tok,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isHTTPS(r),
		Expires:  time.Now().Add(7 * 24 * time.Hour),
	})

	// Clear oauth cookies.
	for _, name := range []string{ghStateCookie, ghVerifierCookie, ghReturnCookie} {
		http.SetCookie(w, &http.Cookie{Name: name, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: isHTTPS(r)})
	}

	http.Redirect(w, r, ret, http.StatusFound)
}

func (s *Server) handleGitHubDisconnect(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	_ = s.Store.DeleteGitHubOAuthToken(r.Context(), uid)
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleGitHubMe(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	t, err := s.Store.GetGitHubOAuthToken(r.Context(), uid)
	if err != nil || t == nil {
		writeJSON(w, 200, map[string]any{"connected": false})
		return
	}
	writeJSON(w, 200, map[string]any{"connected": true, "scopes": t.Scopes})
}

type ghRepo struct {
	ID            int64  `json:"id"`
	FullName      string `json:"full_name"`
	Private       bool   `json:"private"`
	DefaultBranch string `json:"default_branch"`
	UpdatedAt     string `json:"updated_at"`
	HTMLURL       string `json:"html_url"`
}

func (s *Server) handleGitHubRepos(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	t, err := s.Store.GetGitHubOAuthToken(r.Context(), uid)
	if err != nil || t == nil {
		writeJSON(w, 401, map[string]any{"error": "github not connected"})
		return
	}
	pt, err := envcrypt.Decrypt(s.Cfg.EncryptKey, t.AccessTokenEnc)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": "token decrypt failed"})
		return
	}
	token := string(pt)

	query := strings.TrimSpace(r.URL.Query().Get("query"))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page <= 0 {
		page = 1
	}
	per, _ := strconv.Atoi(r.URL.Query().Get("per_page"))
	if per <= 0 || per > 100 {
		per = 30
	}

	u, _ := url.Parse("https://api.github.com/user/repos")
	q := u.Query()
	q.Set("page", strconv.Itoa(page))
	q.Set("per_page", strconv.Itoa(per))
	q.Set("sort", "updated")
	q.Set("direction", "desc")
	// Include repos the user can access (private/public).
	q.Set("affiliation", "owner,collaborator,organization_member")
	u.RawQuery = q.Encode()

	req, _ := http.NewRequestWithContext(r.Context(), "GET", u.String(), nil)
	req.Header.Set("Authorization", "token "+token)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		writeJSON(w, 502, map[string]any{"error": "github request failed"})
		return
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 5<<20))
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		writeJSON(w, 502, map[string]any{"error": "github request failed"})
		return
	}
	var repos []ghRepo
	if err := json.NewDecoder(bytes.NewReader(body)).Decode(&repos); err != nil {
		writeJSON(w, 502, map[string]any{"error": "invalid github response"})
		return
	}

	if query != "" {
		q := strings.ToLower(query)
		out := repos[:0]
		for _, rr := range repos {
			if strings.Contains(strings.ToLower(rr.FullName), q) {
				out = append(out, rr)
			}
		}
		repos = out
	}

	writeJSON(w, 200, map[string]any{
		"page":     page,
		"per_page": per,
		"repos":    repos,
	})
}
