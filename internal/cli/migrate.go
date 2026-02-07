package cli

import (
	"fmt"

	"github.com/pressly/goose/v3"
	"github.com/spf13/cobra"
)

func newMigrateCmd() *cobra.Command {
	var dsn string
	var dir string
	cmd := &cobra.Command{
		Use:   "migrate",
		Short: "Run database migrations",
		RunE: func(cmd *cobra.Command, args []string) error {
			if dsn == "" {
				return fmt.Errorf("--dsn is required")
			}
			if dir == "" {
				return fmt.Errorf("--dir is required")
			}
			db, err := goose.OpenDBWithDriver("pgx", dsn)
			if err != nil {
				return err
			}
			defer db.Close()
			if err := goose.Up(db, dir); err != nil {
				return err
			}
			return nil
		},
	}
	cmd.Flags().StringVar(&dsn, "dsn", "", "Postgres DSN")
	cmd.Flags().StringVar(&dir, "dir", "./migrations", "Migrations directory")
	return cmd
}

