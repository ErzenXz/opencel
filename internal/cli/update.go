package cli

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

func newUpdateCmd() *cobra.Command {
	var installDir string
	var skipPull bool
	var withSelf bool
	var version string
	var installRepo string
	cmd := &cobra.Command{
		Use:   "update",
		Short: "Update an existing OpenCel installation",
		Long: "Update refreshes an existing OpenCel install at /opt/opencel by pulling\n" +
			"new container images and restarting services.\n\n" +
			"Optionally, --self can upgrade the opencel CLI binary first.",
		RunE: func(cmd *cobra.Command, args []string) error {
			out := cmd.OutOrStdout()
			if strings.TrimSpace(installDir) == "" {
				installDir = "/opt/opencel"
			}
			composePath := filepath.Join(installDir, "docker-compose.yml")
			if _, err := os.Stat(composePath); err != nil {
				return fmt.Errorf("could not find %s (is OpenCel installed there?)", composePath)
			}

			if !commandExists("docker") {
				return fmt.Errorf("docker not found in PATH")
			}
			if err := exec.Command("docker", "compose", "version").Run(); err != nil {
				return fmt.Errorf("docker compose plugin not working: %w", err)
			}

			if withSelf {
				fmt.Fprintln(out, "Self-updating CLI binary...")
				if err := runSelfUpdate(out, version, installRepo); err != nil {
					return err
				}
				fmt.Fprintln(out, "CLI update complete.")
			}

			fmt.Fprintf(out, "Updating OpenCel services in %s\n", installDir)
			if !skipPull {
				if err := run(cmd, installDir, "docker", "compose", "pull"); err != nil {
					return err
				}
			}
			if err := run(cmd, installDir, "docker", "compose", "up", "-d"); err != nil {
				return err
			}
			fmt.Fprintln(out, "Update complete.")
			return nil
		},
	}

	cmd.Flags().StringVar(&installDir, "dir", "/opt/opencel", "Install directory")
	cmd.Flags().BoolVar(&skipPull, "skip-pull", false, "Skip docker compose pull")
	cmd.Flags().BoolVar(&withSelf, "self", false, "Also update the opencel CLI binary first")
	cmd.Flags().StringVar(&version, "version", "latest", "CLI version when using --self (default latest)")
	cmd.Flags().StringVar(&installRepo, "install-repo", "ErzenXz/opencel", "GitHub repo for installer assets when using --self")
	return cmd
}

func runSelfUpdate(out io.Writer, version string, repo string) error {
	repo = strings.TrimSpace(repo)
	if repo == "" {
		repo = "ErzenXz/opencel"
	}
	scriptURL := fmt.Sprintf("https://raw.githubusercontent.com/%s/main/install/install.sh", repo)
	cmd := exec.Command("sh", "-c", "curl -fsSL \"$OPENCEL_INSTALL_SCRIPT_URL\" | sh")
	cmd.Stdout = out
	cmd.Stderr = os.Stderr
	cmd.Env = append(
		os.Environ(),
		"OPENCEL_INTERACTIVE=0",
		fmt.Sprintf("OPENCEL_INSTALL_SCRIPT_URL=%s", scriptURL),
		fmt.Sprintf("OPENCEL_VERSION=%s", version),
		fmt.Sprintf("OPENCEL_INSTALL_REPO=%s", repo),
	)
	return cmd.Run()
}
