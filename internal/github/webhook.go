package github

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

func VerifyWebhookSignature(r *http.Request, secret string, body []byte) error {
	if secret == "" {
		return errors.New("webhook secret not configured")
	}
	sig := r.Header.Get("X-Hub-Signature-256")
	if sig == "" {
		return errors.New("missing X-Hub-Signature-256")
	}
	const prefix = "sha256="
	if !strings.HasPrefix(sig, prefix) {
		return fmt.Errorf("unexpected signature format")
	}
	wantHex := strings.TrimPrefix(sig, prefix)
	want, err := hex.DecodeString(wantHex)
	if err != nil {
		return fmt.Errorf("invalid signature hex")
	}

	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write(body)
	got := mac.Sum(nil)
	if !hmac.Equal(got, want) {
		return errors.New("invalid signature")
	}
	return nil
}

func ReadBody(r *http.Request) ([]byte, error) {
	defer r.Body.Close()
	return io.ReadAll(io.LimitReader(r.Body, 10<<20))
}

