package github

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http/httptest"
	"testing"
)

func TestVerifyWebhookSignature(t *testing.T) {
	secret := "abc123"
	body := []byte(`{"hello":"world"}`)

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	sum := mac.Sum(nil)

	req := httptest.NewRequest("POST", "http://example/webhook", nil)
	req.Header.Set("X-Hub-Signature-256", "sha256="+hex.EncodeToString(sum))

	if err := VerifyWebhookSignature(req, secret, body); err != nil {
		t.Fatalf("expected ok, got err: %v", err)
	}
}

