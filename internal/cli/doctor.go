package cli

import (
	"context"
	"fmt"
	"os/exec"
	"syscall"
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
			out := cmd.OutOrStdout()

			// Docker checks.
			if _, err := exec.LookPath("docker"); err != nil {
				return fmt.Errorf("docker not found in PATH")
			}
			if err := exec.Command("docker", "version").Run(); err != nil {
				return fmt.Errorf("docker not working: %w", err)
			}
			fmt.Fprintln(out, "ok: docker")
			if err := exec.Command("docker", "compose", "version").Run(); err != nil {
				return fmt.Errorf("docker compose plugin not working: %w", err)
			}
			fmt.Fprintln(out, "ok: docker compose")

			// Disk space sanity check (root FS).
			var st syscall.Statfs_t
			if err := syscall.Statfs("/", &st); err == nil {
				free := st.Bavail * uint64(st.Bsize)
				// Warn-ish threshold: 2GiB free.
				if free < 2*1024*1024*1024 {
					return fmt.Errorf("low disk space: %d bytes available on /", free)
				}
				fmt.Fprintln(out, "ok: disk space")
			}

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
			fmt.Fprintln(out, "ok: postgres")
			return nil
		},
	}
	cmd.Flags().StringVar(&dsn, "dsn", "", "Postgres DSN")
	return cmd
}
