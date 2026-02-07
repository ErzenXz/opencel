package settings

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/opencel/opencel/internal/crypto/envcrypt"
	"github.com/opencel/opencel/internal/db"
)

// Store persists instance-level configuration in Postgres.
// Secrets are encrypted using OPENCEL_ENV_KEY_B64 (same key used for env vars).
type Store struct {
	DB         *sql.DB
	EncryptKey []byte
}

func New(store *db.Store, encryptKey []byte) *Store {
	return &Store{DB: store.DB, EncryptKey: encryptKey}
}

type Row struct {
	Key       string
	ValueJSON []byte
	HasSecret bool
	UpdatedAt time.Time
}

func (s *Store) GetRow(ctx context.Context, key string) (*Row, error) {
	var r Row
	err := s.DB.QueryRowContext(ctx, `
		SELECT key, value_json, (secret_enc IS NOT NULL), updated_at
		FROM instance_settings
		WHERE key = $1
	`, key).Scan(&r.Key, &r.ValueJSON, &r.HasSecret, &r.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *Store) GetJSON(ctx context.Context, key string, out any) (bool, error) {
	var b []byte
	err := s.DB.QueryRowContext(ctx, `
		SELECT value_json
		FROM instance_settings
		WHERE key = $1
	`, key).Scan(&b)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if out == nil {
		return true, nil
	}
	return true, json.Unmarshal(b, out)
}

func (s *Store) SetJSON(ctx context.Context, key string, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	_, err = s.DB.ExecContext(ctx, `
		INSERT INTO instance_settings (key, value_json, updated_at)
		VALUES ($1, $2, now())
		ON CONFLICT (key) DO UPDATE
		SET value_json = EXCLUDED.value_json,
		    updated_at = now()
	`, key, b)
	return err
}

func (s *Store) HasSecret(ctx context.Context, key string) (bool, error) {
	var ok bool
	err := s.DB.QueryRowContext(ctx, `
		SELECT (secret_enc IS NOT NULL)
		FROM instance_settings
		WHERE key = $1
	`, key).Scan(&ok)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return ok, err
}

func (s *Store) SetSecret(ctx context.Context, key string, plaintext []byte) error {
	if len(plaintext) == 0 {
		_, err := s.DB.ExecContext(ctx, `
			INSERT INTO instance_settings (key, value_json, secret_enc, updated_at)
			VALUES ($1, '{}'::jsonb, NULL, now())
			ON CONFLICT (key) DO UPDATE
			SET secret_enc = NULL,
			    updated_at = now()
		`, key)
		return err
	}
	if len(s.EncryptKey) != 32 {
		return errors.New("invalid encrypt key")
	}
	enc, err := envcrypt.Encrypt(s.EncryptKey, plaintext)
	if err != nil {
		return err
	}
	_, err = s.DB.ExecContext(ctx, `
		INSERT INTO instance_settings (key, value_json, secret_enc, updated_at)
		VALUES ($1, '{}'::jsonb, $2, now())
		ON CONFLICT (key) DO UPDATE
		SET secret_enc = EXCLUDED.secret_enc,
		    updated_at = now()
	`, key, enc)
	return err
}

func (s *Store) GetSecret(ctx context.Context, key string) ([]byte, bool, error) {
	var enc []byte
	err := s.DB.QueryRowContext(ctx, `
		SELECT secret_enc
		FROM instance_settings
		WHERE key = $1
	`, key).Scan(&enc)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	if len(enc) == 0 {
		return nil, false, nil
	}
	if len(s.EncryptKey) != 32 {
		return nil, false, errors.New("invalid encrypt key")
	}
	pt, err := envcrypt.Decrypt(s.EncryptKey, enc)
	if err != nil {
		return nil, false, err
	}
	return pt, true, nil
}
