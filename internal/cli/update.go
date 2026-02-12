package cli

import (
	"bytes"
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
	var sourceRepoDir string
	var forceSourceBuild bool
	cmd := &cobra.Command{
		Use:   "update",
		Short: "Update an existing OpenCel installation",
		Long: "Update refreshes an existing OpenCel install at /opt/opencel by pulling\n" +
			"new container images and restarting services.\n" +
			"If pulling images fails, it automatically falls back to building from source on the server.\n\n" +
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

			if strings.TrimSpace(sourceRepoDir) == "" {
				sourceRepoDir = filepath.Join(installDir, "repo")
			}

			fmt.Fprintf(out, "Updating OpenCel services in %s\n", installDir)
			if forceSourceBuild {
				if err := runSourceBuildUpdate(cmd, installDir, sourceRepoDir, installRepo); err != nil {
					return err
				}
				fmt.Fprintln(out, "Update complete.")
				return nil
			}

			if !skipPull {
				if err := run(cmd, installDir, "docker", "compose", "pull"); err != nil {
					fmt.Fprintln(out, "docker compose pull failed; falling back to source build on server...")
					if fbErr := runSourceBuildUpdate(cmd, installDir, sourceRepoDir, installRepo); fbErr != nil {
						return fmt.Errorf("docker compose pull failed: %w (source build fallback failed: %v)", err, fbErr)
					}
					fmt.Fprintln(out, "Update complete.")
					return nil
				}
			}
			if err := run(cmd, installDir, "docker", "compose", "up", "-d"); err != nil {
				if skipPull {
					fmt.Fprintln(out, "docker compose up failed; trying source build on server...")
					if fbErr := runSourceBuildUpdate(cmd, installDir, sourceRepoDir, installRepo); fbErr != nil {
						return fmt.Errorf("docker compose up failed: %w (source build fallback failed: %v)", err, fbErr)
					}
					fmt.Fprintln(out, "Update complete.")
					return nil
				}
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
	cmd.Flags().StringVar(&sourceRepoDir, "repo", "", "Repo checkout directory used for source-build fallback (default <dir>/repo)")
	cmd.Flags().BoolVar(&forceSourceBuild, "build", false, "Build and update services from source on this server")
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

func runSourceBuildUpdate(cmd *cobra.Command, installDir, repoDir, repo string) error {
	out := cmd.OutOrStdout()
	fmt.Fprintf(out, "Preparing source checkout at %s\n", repoDir)
	if err := syncSourceRepo(cmd, repoDir, repo); err != nil {
		return err
	}

	envPath := filepath.Join(installDir, ".env")
	envMap := readEnvFile(envPath)
	tlsMode := "letsencrypt"
	if strings.EqualFold(strings.TrimSpace(envMap["OPENCEL_TRAEFIK_TLS"]), "false") {
		tlsMode = "cloudflare"
	}
	if err := upsertEnvFileKV(envPath, "OPENCEL_REPO_DIR", repoDir); err != nil {
		return fmt.Errorf("update %s: %w", envPath, err)
	}

	composePath := filepath.Join(installDir, "docker-compose.yml")
	if tlsMode == "cloudflare" {
		if err := os.WriteFile(composePath, []byte(localBuildComposeCloudflare), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", composePath, err)
		}
	} else {
		if err := os.WriteFile(composePath, []byte(localBuildComposeLetsEncrypt), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", composePath, err)
		}
	}

	fmt.Fprintln(out, "Rebuilding and restarting services from source...")
	return run(cmd, installDir, "docker", "compose", "up", "-d", "--build")
}

func syncSourceRepo(cmd *cobra.Command, repoDir, repo string) error {
	repo = strings.TrimSpace(repo)
	if repo == "" {
		repo = "ErzenXz/opencel"
	}
	repoURL := fmt.Sprintf("https://github.com/%s.git", repo)
	if !commandExists("git") {
		return fmt.Errorf("git not found in PATH; required for source-build fallback")
	}

	parent := filepath.Dir(repoDir)
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return err
	}
	if _, err := os.Stat(filepath.Join(repoDir, ".git")); err == nil {
		if err := run(cmd, repoDir, "git", "fetch", "--all", "--tags", "--prune"); err != nil {
			return err
		}
		if err := run(cmd, repoDir, "git", "pull", "--ff-only"); err != nil {
			return err
		}
		return nil
	}
	if _, err := os.Stat(repoDir); err == nil {
		if entries, readErr := os.ReadDir(repoDir); readErr == nil && len(entries) > 0 {
			return fmt.Errorf("repo dir %s exists but is not a git checkout", repoDir)
		}
	}
	return run(cmd, parent, "git", "clone", "--depth", "1", repoURL, repoDir)
}

func upsertEnvFileKV(path, key, value string) error {
	if strings.TrimSpace(key) == "" {
		return fmt.Errorf("empty key")
	}
	trimmedKey := strings.TrimSpace(key)
	newLine := fmt.Sprintf("%s=%s", trimmedKey, value)

	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	lines := strings.Split(string(b), "\n")
	replaced := false
	for i := range lines {
		ln := strings.TrimSpace(lines[i])
		if ln == "" || strings.HasPrefix(ln, "#") {
			continue
		}
		if strings.HasPrefix(ln, trimmedKey+"=") {
			lines[i] = newLine
			replaced = true
		}
	}
	if !replaced {
		lines = append(lines, newLine)
	}
	var buf bytes.Buffer
	for i, line := range lines {
		if i > 0 {
			buf.WriteByte('\n')
		}
		buf.WriteString(line)
	}
	return os.WriteFile(path, buf.Bytes(), 0o600)
}
