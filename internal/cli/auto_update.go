package cli

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
)

const (
	autoUpdateServiceName = "opencel-update"
	autoUpdateServicePath = "/etc/systemd/system/opencel-update.service"
	autoUpdateTimerPath   = "/etc/systemd/system/opencel-update.timer"
)

func newAutoUpdateCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auto-update",
		Short: "Manage automatic updates (systemd timer)",
		Long: "Install, remove, or inspect a systemd timer that runs\n" +
			"'opencel update' on a schedule. Use 'enable' once and forget —\n" +
			"your server will stay up to date automatically.",
	}
	cmd.AddCommand(newAutoUpdateEnableCmd())
	cmd.AddCommand(newAutoUpdateDisableCmd())
	cmd.AddCommand(newAutoUpdateStatusCmd())
	return cmd
}

func newAutoUpdateEnableCmd() *cobra.Command {
	var installDir string
	var schedule string
	var withSelf bool
	var installRepo string
	cmd := &cobra.Command{
		Use:   "enable",
		Short: "Install a systemd timer that runs 'opencel update' on a schedule",
		RunE: func(cmd *cobra.Command, args []string) error {
			out := cmd.OutOrStdout()
			if !commandExists("systemctl") {
				return fmt.Errorf("systemctl not found; auto-update requires systemd. Use cron instead (see docs)")
			}
			if os.Geteuid() != 0 {
				return fmt.Errorf("enable requires root. Re-run with: sudo opencel auto-update enable")
			}
			binPath, err := resolveOpenCelBinary()
			if err != nil {
				return err
			}
			schedule = strings.TrimSpace(schedule)
			if schedule == "" {
				schedule = "daily"
			}
			installDir = strings.TrimSpace(installDir)
			if installDir == "" {
				installDir = "/opt/opencel"
			}
			installRepo = strings.TrimSpace(installRepo)
			if installRepo == "" {
				installRepo = "ErzenXz/opencel"
			}

			execArgs := []string{"update", "--dir", installDir, "--install-repo", installRepo}
			if withSelf {
				execArgs = append(execArgs, "--self")
			}
			parts := make([]string, 0, len(execArgs)+1)
			parts = append(parts, quoteForSystemd(binPath))
			for _, a := range execArgs {
				parts = append(parts, quoteForSystemd(a))
			}
			execLine := strings.Join(parts, " ")

			service := "" +
				"[Unit]\n" +
				"Description=OpenCel automatic update\n" +
				"Wants=network-online.target\n" +
				"After=network-online.target docker.service\n\n" +
				"[Service]\n" +
				"Type=oneshot\n" +
				"ExecStart=" + execLine + "\n"
			if err := os.WriteFile(autoUpdateServicePath, []byte(service), 0o644); err != nil {
				return fmt.Errorf("write %s: %w", autoUpdateServicePath, err)
			}

			timer := "" +
				"[Unit]\n" +
				"Description=Run OpenCel update on a schedule\n\n" +
				"[Timer]\n" +
				"OnCalendar=" + schedule + "\n" +
				"Persistent=true\n" +
				"RandomizedDelaySec=30min\n" +
				"Unit=" + autoUpdateServiceName + ".service\n\n" +
				"[Install]\n" +
				"WantedBy=timers.target\n"
			if err := os.WriteFile(autoUpdateTimerPath, []byte(timer), 0o644); err != nil {
				return fmt.Errorf("write %s: %w", autoUpdateTimerPath, err)
			}

			if err := exec.Command("systemctl", "daemon-reload").Run(); err != nil {
				return fmt.Errorf("systemctl daemon-reload: %w", err)
			}
			if err := exec.Command("systemctl", "enable", "--now", autoUpdateServiceName+".timer").Run(); err != nil {
				return fmt.Errorf("systemctl enable --now %s.timer: %w", autoUpdateServiceName, err)
			}

			fmt.Fprintf(out, "Auto-update enabled (%s).\n", schedule)
			fmt.Fprintf(out, "Runs: %s\n", execLine)
			fmt.Fprintln(out, "Check status with: opencel auto-update status")
			return nil
		},
	}
	cmd.Flags().StringVar(&installDir, "dir", "/opt/opencel", "Install directory passed to 'opencel update'")
	cmd.Flags().StringVar(&schedule, "schedule", "daily", "systemd OnCalendar= expression (e.g. daily, hourly, 'Mon *-*-* 04:00:00')")
	cmd.Flags().BoolVar(&withSelf, "self", true, "Also self-update the CLI binary during each run")
	cmd.Flags().StringVar(&installRepo, "install-repo", "ErzenXz/opencel", "GitHub repo for installer assets")
	return cmd
}

func newAutoUpdateDisableCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "disable",
		Short: "Remove the systemd timer that runs 'opencel update'",
		RunE: func(cmd *cobra.Command, args []string) error {
			out := cmd.OutOrStdout()
			if !commandExists("systemctl") {
				return fmt.Errorf("systemctl not found; nothing to disable")
			}
			if os.Geteuid() != 0 {
				return fmt.Errorf("disable requires root. Re-run with: sudo opencel auto-update disable")
			}
			_ = exec.Command("systemctl", "disable", "--now", autoUpdateServiceName+".timer").Run()
			removed := false
			for _, p := range []string{autoUpdateTimerPath, autoUpdateServicePath} {
				if _, err := os.Stat(p); err == nil {
					if err := os.Remove(p); err != nil {
						return fmt.Errorf("remove %s: %w", p, err)
					}
					removed = true
				}
			}
			_ = exec.Command("systemctl", "daemon-reload").Run()
			if removed {
				fmt.Fprintln(out, "Auto-update disabled.")
			} else {
				fmt.Fprintln(out, "Auto-update was not installed; nothing to do.")
			}
			return nil
		},
	}
	return cmd
}

func newAutoUpdateStatusCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "status",
		Short: "Show whether the auto-update timer is active and when it next runs",
		RunE: func(cmd *cobra.Command, args []string) error {
			out := cmd.OutOrStdout()
			if !commandExists("systemctl") {
				fmt.Fprintln(out, "systemctl not available; auto-update status unknown")
				return nil
			}
			if _, err := os.Stat(autoUpdateTimerPath); err != nil {
				fmt.Fprintln(out, "Auto-update: not installed")
				fmt.Fprintln(out, "Enable with: sudo opencel auto-update enable")
				return nil
			}
			active, _ := exec.Command("systemctl", "is-active", autoUpdateServiceName+".timer").Output()
			fmt.Fprintf(out, "Auto-update timer: %s", strings.TrimSpace(string(active)))
			fmt.Fprintln(out)
			listOut, err := exec.Command("systemctl", "list-timers", "--all", autoUpdateServiceName+".timer").CombinedOutput()
			if err == nil {
				fmt.Fprintln(out, strings.TrimRight(string(listOut), "\n"))
			}
			return nil
		},
	}
	return cmd
}

// quoteForSystemd quotes a token for use inside a systemd ExecStart= line.
// Systemd splits on whitespace, so any argument containing whitespace or
// special characters must be wrapped in double quotes with \ and " escaped.
func quoteForSystemd(s string) string {
	hasSpecial := strings.ContainsAny(s, " \t\"\\\n")
	hasPercent := strings.Contains(s, "%")
	hasDollar := strings.Contains(s, "$")
	if !hasSpecial && !hasPercent && !hasDollar {
		return s
	}
	replaced := strings.ReplaceAll(s, `%`, `%%`)
	replaced = strings.ReplaceAll(replaced, `$`, `$$`)
	if !hasSpecial {
		return replaced
	}
	replaced = strings.ReplaceAll(strings.ReplaceAll(replaced, `\`, `\\`), `"`, `\"`)
	return `"` + replaced + `"`
}

func resolveOpenCelBinary() (string, error) {
	if p, err := os.Executable(); err == nil {
		if abs, err := filepath.Abs(p); err == nil {
			if _, err := os.Stat(abs); err == nil {
				return abs, nil
			}
		}
	}
	if p, err := exec.LookPath("opencel"); err == nil {
		return p, nil
	}
	return "", fmt.Errorf("could not locate the opencel binary on disk")
}
