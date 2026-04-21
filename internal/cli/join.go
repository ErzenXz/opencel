package cli

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"
)

// subtleCompare wraps crypto/subtle.ConstantTimeCompare so auth checks run in
// constant time regardless of where the mismatch is.
func subtleCompare(a, b string) int {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b))
}

// Config file persisted on secondary nodes after `opencel join`.
type nodeConfig struct {
	Server string `json:"server"`
	Token  string `json:"token"`
	Listen string `json:"listen"`
}

func nodeConfigPath() string {
	if v := strings.TrimSpace(os.Getenv("OPENCEL_NODE_CONFIG")); v != "" {
		return v
	}
	return "/etc/opencel/node.json"
}

func loadNodeConfig() (*nodeConfig, error) {
	b, err := os.ReadFile(nodeConfigPath())
	if err != nil {
		return nil, err
	}
	var c nodeConfig
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, err
	}
	return &c, nil
}

func saveNodeConfig(c *nodeConfig) error {
	path := nodeConfigPath()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, b, 0o600)
}

func newJoinCmd() *cobra.Command {
	var server string
	var token string
	var listen string
	cmd := &cobra.Command{
		Use:   "join",
		Short: "Join this VM as a worker node to an existing OpenCel control plane",
		RunE: func(cmd *cobra.Command, args []string) error {
			if strings.TrimSpace(server) == "" {
				return fmt.Errorf("--server is required (primary OpenCel URL)")
			}
			if strings.TrimSpace(token) == "" {
				return fmt.Errorf("--token is required (node registration token)")
			}
			cfg := &nodeConfig{
				Server: strings.TrimRight(server, "/"),
				Token:  token,
				Listen: strings.TrimSpace(listen),
			}
			if cfg.Listen == "" {
				cfg.Listen = ":7789"
			}
			if err := heartbeat(cmd.Context(), cfg); err != nil {
				return fmt.Errorf("initial registration failed: %w", err)
			}
			if err := saveNodeConfig(cfg); err != nil {
				return fmt.Errorf("save node config: %w", err)
			}
			fmt.Fprintln(cmd.OutOrStdout(), "Node registered with", cfg.Server)
			fmt.Fprintln(cmd.OutOrStdout(), "Config written to", nodeConfigPath())
			fmt.Fprintln(cmd.OutOrStdout(), "Run `opencel agent` to stay online and accept workloads.")
			return nil
		},
	}
	cmd.Flags().StringVar(&server, "server", "", "Primary OpenCel base URL (e.g. https://opencel.example.com)")
	cmd.Flags().StringVar(&token, "token", "", "Node registration token (shown when the node is created in the UI)")
	cmd.Flags().StringVar(&listen, "listen", ":7789", "Agent listen address for incoming control-plane requests")
	return cmd
}

func newAgentCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "agent",
		Short: "Run the OpenCel node agent (call this on secondary VMs after `opencel join`)",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg, err := loadNodeConfig()
			if err != nil {
				return fmt.Errorf("load node config (%s): %w", nodeConfigPath(), err)
			}
			return runAgent(cmd.Context(), cfg)
		},
	}
	return cmd
}

func heartbeatURL(server string) string {
	return strings.TrimRight(server, "/") + "/api/nodes/register"
}

func heartbeat(ctx context.Context, cfg *nodeConfig) error {
	host, _ := os.Hostname()
	cpu := runtime.NumCPU()
	body := map[string]any{
		"agent_url":     localAgentURL(cfg.Listen),
		"hostname":      host,
		"agent_version": "dev",
		"cpu_cores":     cpu,
		"memory_bytes":  systemMemoryBytes(),
		"metrics": map[string]any{
			"uptime_s": int(time.Since(agentStart).Seconds()),
		},
	}
	b, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, "POST", heartbeatURL(cfg.Server), bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.Token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		out, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("status %d: %s", resp.StatusCode, string(out))
	}
	return nil
}

var agentStart = time.Now()

func localAgentURL(listen string) string {
	host, _ := os.Hostname()
	if strings.HasPrefix(listen, ":") {
		return fmt.Sprintf("http://%s%s", host, listen)
	}
	return "http://" + listen
}

func systemMemoryBytes() int64 {
	b, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}
	for _, ln := range strings.Split(string(b), "\n") {
		if strings.HasPrefix(ln, "MemTotal:") {
			parts := strings.Fields(ln)
			if len(parts) >= 2 {
				var kb int64
				_, _ = fmt.Sscanf(parts[1], "%d", &kb)
				return kb * 1024
			}
		}
	}
	return 0
}

type provisionSpecIn struct {
	ServiceID    string `json:"service_id"`
	Kind         string `json:"kind"`
	Version      string `json:"version"`
	Name         string `json:"name"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	DatabaseName string `json:"database"`
	Network      string `json:"network"`
}

type provisionSpecOut struct {
	ContainerName string `json:"container_name"`
	InternalHost  string `json:"internal_host"`
	InternalPort  int    `json:"internal_port"`
}

func runAgent(ctx context.Context, cfg *nodeConfig) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte("ok")) })
	mux.HandleFunc("/agent/services", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "method", 405)
			return
		}
		// Require the node's registration token. Without this the agent is an
		// unauthenticated `docker run` executor for anyone who can reach the
		// listen port.
		authz := r.Header.Get("Authorization")
		const pfx = "Bearer "
		if !strings.HasPrefix(authz, pfx) || subtleCompare(strings.TrimPrefix(authz, pfx), cfg.Token) != 1 {
			http.Error(w, "unauthorized", 401)
			return
		}
		var in provisionSpecIn
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			http.Error(w, "bad json", 400)
			return
		}
		out, err := agentProvision(r.Context(), in)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
	})

	srv := &http.Server{Addr: cfg.Listen, Handler: mux}
	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()

	// Heartbeat loop.
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	if err := heartbeat(ctx, cfg); err != nil {
		fmt.Fprintln(os.Stderr, "heartbeat warning:", err)
	}
	fmt.Println("opencel agent listening on", cfg.Listen, "talking to", cfg.Server)
	for {
		select {
		case err := <-errCh:
			return err
		case <-ticker.C:
			if err := heartbeat(ctx, cfg); err != nil {
				fmt.Fprintln(os.Stderr, "heartbeat warning:", err)
			}
		case <-sigCh:
			_ = srv.Close()
			return nil
		}
	}
}

func agentProvision(ctx context.Context, in provisionSpecIn) (provisionSpecOut, error) {
	container := agentContainerName(in.ServiceID, in.Name)
	_ = exec.CommandContext(ctx, "docker", "rm", "-f", container).Run()
	image, env, cmdArgs, port, err := agentImageFor(in)
	if err != nil {
		return provisionSpecOut{}, err
	}
	args := []string{"run", "-d", "--restart", "unless-stopped", "--name", container}
	if in.Network != "" {
		args = append(args, "--network", in.Network)
	}
	for _, e := range env {
		args = append(args, "-e", e)
	}
	args = append(args, image)
	args = append(args, cmdArgs...)
	var stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, "docker", args...)
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return provisionSpecOut{}, fmt.Errorf("docker run: %v: %s", err, stderr.String())
	}
	return provisionSpecOut{ContainerName: container, InternalHost: container, InternalPort: port}, nil
}

// agentContainerName mirrors containerNameForService on the control plane.
// Include the service id so two orgs with services named "redis" don't
// clobber each other if they share a host.
func agentContainerName(serviceID, name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-', r == '_':
			b.WriteRune('-')
		}
	}
	slug := strings.Trim(b.String(), "-")
	if slug == "" {
		slug = "svc"
	}
	short := strings.ReplaceAll(serviceID, "-", "")
	if len(short) > 8 {
		short = short[:8]
	}
	if short == "" {
		return "opencel-svc-" + slug
	}
	return "opencel-svc-" + short + "-" + slug
}

func agentImageFor(in provisionSpecIn) (image string, env []string, cmdArgs []string, port int, err error) {
	def := func(v, d string) string {
		if strings.TrimSpace(v) == "" {
			return d
		}
		return v
	}
	switch in.Kind {
	case "postgres":
		image = "postgres:" + def(in.Version, "16")
		env = []string{
			"POSTGRES_USER=" + def(in.Username, "opencel"),
			"POSTGRES_PASSWORD=" + in.Password,
			"POSTGRES_DB=" + def(in.DatabaseName, "opencel"),
		}
		port = 5432
	case "redis":
		image = "redis:" + def(in.Version, "7")
		cmdArgs = []string{"redis-server", "--requirepass", in.Password}
		port = 6379
	case "mysql":
		image = "mysql:" + def(in.Version, "8")
		env = []string{
			"MYSQL_ROOT_PASSWORD=" + in.Password,
			"MYSQL_USER=" + def(in.Username, "opencel"),
			"MYSQL_PASSWORD=" + in.Password,
			"MYSQL_DATABASE=" + def(in.DatabaseName, "opencel"),
		}
		port = 3306
	case "mongodb":
		image = "mongo:" + def(in.Version, "7")
		env = []string{
			"MONGO_INITDB_ROOT_USERNAME=" + def(in.Username, "opencel"),
			"MONGO_INITDB_ROOT_PASSWORD=" + in.Password,
			"MONGO_INITDB_DATABASE=" + def(in.DatabaseName, "opencel"),
		}
		port = 27017
	default:
		err = fmt.Errorf("unsupported kind %q", in.Kind)
	}
	return
}
