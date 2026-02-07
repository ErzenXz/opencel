package envcrypt

import "testing"

func TestEncryptDecrypt(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	msg := []byte("hello-secret")

	blob, err := Encrypt(key, msg)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	got, err := Decrypt(key, blob)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if string(got) != string(msg) {
		t.Fatalf("roundtrip mismatch: got %q want %q", string(got), string(msg))
	}
}

