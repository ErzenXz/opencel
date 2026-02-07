package api

import (
	"fmt"
	"os"

	"github.com/pressly/goose/v3"
)

func RunMigrations(dsn string) error {
	dir := os.Getenv("OPENCEL_MIGRATIONS_DIR")
	if dir == "" {
		dir = "/migrations"
	}
	db, err := goose.OpenDBWithDriver("pgx", dsn)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := goose.Up(db, dir); err != nil {
		return fmt.Errorf("goose up (%s): %w", dir, err)
	}
	return nil
}
