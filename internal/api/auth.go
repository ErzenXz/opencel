package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/opencel/opencel/internal/db"
	"golang.org/x/crypto/bcrypt"
)

const authCookieName = "opencel_token"

type ctxKey string

const ctxUserID ctxKey = "user_id"

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type meResp struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func BootstrapAdmin(ctx context.Context, store *db.Store, email, password string) error {
	if email == "" || password == "" {
		return nil
	}
	n, err := store.CountUsers(ctx)
	if err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = store.CreateUser(ctx, email, string(hash))
	return err
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, 400, map[string]any{"error": "invalid json"})
		return
	}
	u, err := s.Store.GetUserByEmail(r.Context(), req.Email)
	if err != nil || u == nil {
		writeJSON(w, 401, map[string]any{"error": "invalid credentials"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(req.Password)); err != nil {
		writeJSON(w, 401, map[string]any{"error": "invalid credentials"})
		return
	}
	tok, err := s.signJWT(u.ID)
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
		// Secure should be true for HTTPS, including behind a reverse proxy.
		Secure:  isHTTPS(r),
		Expires: time.Now().Add(7 * 24 * time.Hour),
	})
	writeJSON(w, 200, map[string]any{"ok": true})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isHTTPS(r),
		MaxAge:   -1,
	})
	writeJSON(w, 200, map[string]any{"ok": true})
}

func isHTTPS(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	// Common proxy headers.
	if strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") {
		return true
	}
	if strings.EqualFold(r.Header.Get("X-Forwarded-Ssl"), "on") {
		return true
	}
	// Cloudflare Tunnel often sets Cf-Visitor: {"scheme":"https"}
	if v := r.Header.Get("Cf-Visitor"); v != "" && strings.Contains(strings.ToLower(v), "\"scheme\":\"https\"") {
		return true
	}
	return false
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	uid := userIDFromCtx(r.Context())
	u, err := s.Store.GetUserByID(r.Context(), uid)
	if err != nil || u == nil {
		writeJSON(w, 401, map[string]any{"error": "unauthorized"})
		return
	}
	writeJSON(w, 200, meResp{ID: u.ID, Email: u.Email})
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(authCookieName)
		if err != nil || c.Value == "" {
			writeJSON(w, 401, map[string]any{"error": "unauthorized"})
			return
		}
		uid, err := s.verifyJWT(c.Value)
		if err != nil {
			writeJSON(w, 401, map[string]any{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxUserID, uid)))
	})
}

func userIDFromCtx(ctx context.Context) string {
	v, _ := ctx.Value(ctxUserID).(string)
	return v
}

func (s *Server) signJWT(userID string) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat": time.Now().Unix(),
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString([]byte(s.Cfg.JWTSecret))
}

func (s *Server) verifyJWT(tokenStr string) (string, error) {
	tok, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.Cfg.JWTSecret), nil
	})
	if err != nil || tok == nil || !tok.Valid {
		return "", errors.New("invalid token")
	}
	claims, ok := tok.Claims.(jwt.MapClaims)
	if !ok {
		return "", errors.New("invalid claims")
	}
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return "", errors.New("missing sub")
	}
	return sub, nil
}
