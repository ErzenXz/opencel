package cli

import (
	"context"
	"fmt"
	"time"

	"github.com/opencel/opencel/internal/db"
	"github.com/spf13/cobra"
)

func newDoctorCmd() *cobra.Command {
	var dsn string
	cmd := &cobra.Command{
		Use:   "doctor",
		Short: "Check basic OpenCel dependencies",
		RunE: func(cmd *cobra.Command, args []string) error {
			if dsn == "" {
				return fmt.Errorf("--dsn is required")
			}
			conn, err := db.Open(dsn)
			if err != nil {
				return err
			}
			defer conn.Close()
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := db.Ping(ctx, conn); err != nil {
				return fmt.Errorf("db ping failed: %w", err)
			}
			fmt.Fprintln(cmd.OutOrStdout(), "ok: postgres")
			return nil
		},
	}
	cmd.Flags().StringVar(&dsn, "dsn", "", "Postgres DSN")
	return cmd
}

