package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type setupStatusResp struct {
	NeedsSetup bool `json:"needs_setup"`
}

func (s *Server) handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	n, err := s.Store.CountUsers(r.Context())
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, 200, setupStatusResp{NeedsSetup: n == 0})
}

type setupReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	OrgName  string `json:"org_name"`
}

type setupResp struct {
	OK    bool      `json:"ok"`
	User  meResp    `json:"user"`
	OrgID string    `json:"org_id"`
	At    time.Time `json:"at"`
}

var orgSlugUnsafe = regexp.MustCompile(`[^a-z0-9-]+`)
var orgSlugTrim = regexp.MustCompile(`^-+|-+$`)

func slugifyOrg(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	if s == "" {
		return "personal"
	}
	s = strings.ReplaceAll(s, "_", "-")
	s = strings.ReplaceAll(s, " ", "-")
	s = orgSlugUnsafe.ReplaceAllString(s, "-")
	s = orgSlugTrim.ReplaceAllString(s, "")
	if len(s) < 2 {
		return "personal"
	}
	if len(s) > 32 {
		s = s[:32]
		s = orgSlugTrim.ReplaceAllString(s, "")
	}
	return s
}

func (s *Server) handleSetup(w http.ResponseWriter, r *http.Request) {
	var req setupReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	req.Password = strings.TrimSpace(req.Password)
	req.OrgName = strings.TrimSpace(req.OrgName)
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		writeJSON(w, 400, map[string]any{"error": "invalid email"})
		return
	}
	if len(req.Password) < 8 {
		writeJSON(w, 400, map[string]any{"error": "password must be at least 8 characters"})
		return
	}
	if req.OrgName == "" {
		req.OrgName = "Personal"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}

	tx, err := s.Store.DB.BeginTx(r.Context(), &sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	defer func() { _ = tx.Rollback() }()

	// Ensure only first setup wins.
	var userCount int
	if err := tx.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM users`).Scan(&userCount); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}
	if userCount > 0 {
		writeJSON(w, 409, map[string]any{"error": "already setup"})
		return
	}

	// Create user.
	var userID string
	if err := tx.QueryRowContext(r.Context(), `
		INSERT INTO users (email, password_hash, is_instance_admin)
		VALUES ($1, $2, true)
		RETURNING id
	`, req.Email, string(hash)).Scan(&userID); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}

	// Create org.
	orgSlug := slugifyOrg(req.OrgName)
	var orgID string
	if err := tx.QueryRowContext(r.Context(), `
		INSERT INTO organizations (slug, name)
		VALUES ($1, $2)
		RETURNING id
	`, orgSlug, req.OrgName).Scan(&orgID); err != nil {
		// Fallback slug if conflict.
		if err := tx.QueryRowContext(r.Context(), `
			INSERT INTO organizations (slug, name)
			VALUES ($1, $2)
			RETURNING id
		`, orgSlug+"-1", req.OrgName).Scan(&orgID); err != nil {
			writeJSON(w, 500, map[string]any{"error": err.Error()})
			return
		}
	}

	// Membership.
	if _, err := tx.ExecContext(r.Context(), `
		INSERT INTO organization_memberships (org_id, user_id, role)
		VALUES ($1, $2, 'owner')
	`, orgID, userID); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}

	if err := tx.Commit(); err != nil {
		writeJSON(w, 500, map[string]any{"error": err.Error()})
		return
	}

	// Log in immediately.
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

	writeJSON(w, 201, setupResp{
		OK:    true,
		User:  meResp{ID: userID, Email: req.Email, IsInstanceAdmin: true},
		OrgID: orgID,
		At:    time.Now(),
	})
}

// Helper for unit tests.
func setupTxIsolation(ctx context.Context) *sql.TxOptions {
	return &sql.TxOptions{Isolation: sql.LevelSerializable}
}
