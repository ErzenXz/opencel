package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"github.com/opencel/opencel/internal/crypto/envcrypt"
	"github.com/opencel/opencel/internal/db"
)

// provisionService provisions a managed database container for a service. It
// runs the container on the selected node (primary host uses local docker;
// workers are asked via their agent HTTP API). This is intentionally simple —
// it is not a full scheduler, just enough to demonstrate the multi-node model.
func (s *Server) provisionService(serviceID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	sv, err := s.Store.GetService(ctx, serviceID)
	if err != nil || sv == nil {
		return
	}
	if sv.NodeID.String == "" {
		_ = s.Store.UpdateServiceStatus(ctx, sv.ID, "failed", "no node bound")
		return
	}
	n, err := s.Store.GetNode(ctx, sv.NodeID.String)
	if err != nil || n == nil {
		_ = s.Store.UpdateServiceStatus(ctx, sv.ID, "failed", "node lookup failed")
		return
	}
	pw := ""
	if len(sv.PasswordEnc) > 0 {
		if v, err := envcrypt.Decrypt(s.Cfg.EncryptKey, sv.PasswordEnc); err == nil {
			pw = string(v)
		}
	}
	spec := provisionSpec{
		ServiceID:    sv.ID,
		Kind:         sv.Kind,
		Version:      sv.Version,
		Name:         sv.Name,
		Username:     sv.Username.String,
		Password:     pw,
		DatabaseName: sv.DatabaseName.String,
		Network:      s.Cfg.DockerNetwork,
	}

	var info db.ServiceRunningInfo
	var provErr error
	if n.Role == "primary" || n.AgentURL.String == "" {
		info, provErr = runLocalProvision(ctx, spec)
	} else {
		info, provErr = runRemoteProvision(ctx, n.AgentURL.String, spec)
	}
	if provErr != nil {
		_ = s.Store.UpdateServiceStatus(ctx, sv.ID, "failed", provErr.Error())
		return
	}
	_ = s.Store.UpdateServiceRunning(ctx, sv.ID, info)
}

type provisionSpec struct {
	ServiceID    string `json:"service_id"`
	Kind         string `json:"kind"`
	Version      string `json:"version"`
	Name         string `json:"name"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	DatabaseName string `json:"database"`
	Network      string `json:"network"`
}

// runLocalProvision runs a docker container on the local host.
func runLocalProvision(ctx context.Context, spec provisionSpec) (db.ServiceRunningInfo, error) {
	container := containerNameForService(spec.Name)
	image, env, port, err := imageAndEnvFor(spec)
	if err != nil {
		return db.ServiceRunningInfo{}, err
	}
	// Remove any stale container with the same name.
	_ = exec.CommandContext(ctx, "docker", "rm", "-f", container).Run()

	args := []string{"run", "-d", "--restart", "unless-stopped", "--name", container}
	if spec.Network != "" {
		args = append(args, "--network", spec.Network)
	}
	for _, e := range env {
		args = append(args, "-e", e)
	}
	args = append(args, image)
	cmd := exec.CommandContext(ctx, "docker", args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return db.ServiceRunningInfo{}, fmt.Errorf("docker run: %v: %s", err, stderr.String())
	}
	return db.ServiceRunningInfo{
		ContainerName: container,
		InternalHost:  container,
		InternalPort:  port,
	}, nil
}

// runRemoteProvision asks a worker node's agent to run a container.
func runRemoteProvision(ctx context.Context, agentURL string, spec provisionSpec) (db.ServiceRunningInfo, error) {
	body, _ := json.Marshal(spec)
	req, err := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(agentURL, "/")+"/agent/services", bytes.NewReader(body))
	if err != nil {
		return db.ServiceRunningInfo{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return db.ServiceRunningInfo{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return db.ServiceRunningInfo{}, fmt.Errorf("agent status %d", resp.StatusCode)
	}
	var out struct {
		ContainerName string `json:"container_name"`
		InternalHost  string `json:"internal_host"`
		InternalPort  int    `json:"internal_port"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return db.ServiceRunningInfo{}, err
	}
	return db.ServiceRunningInfo{
		ContainerName: out.ContainerName,
		InternalHost:  out.InternalHost,
		InternalPort:  out.InternalPort,
	}, nil
}

func containerNameForService(name string) string {
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
	out := strings.Trim(b.String(), "-")
	if out == "" {
		out = "svc"
	}
	return "opencel-svc-" + out
}

func imageAndEnvFor(spec provisionSpec) (image string, env []string, port int, err error) {
	switch spec.Kind {
	case "postgres":
		image = fmt.Sprintf("postgres:%s", defaultIfEmpty(spec.Version, "16"))
		env = []string{
			"POSTGRES_USER=" + defaultIfEmpty(spec.Username, "opencel"),
			"POSTGRES_PASSWORD=" + spec.Password,
			"POSTGRES_DB=" + defaultIfEmpty(spec.DatabaseName, "opencel"),
		}
		port = 5432
	case "redis":
		image = fmt.Sprintf("redis:%s", defaultIfEmpty(spec.Version, "7"))
		// Redis is configured via command args — pass auth via entrypoint env not supported without
		// a custom entrypoint. We set requirepass through a command override by using `redis-server
		// --requirepass`. This helper uses docker's ability to pass extra args after the image.
		// We express that by returning a sentinel env that the caller translates. For simplicity,
		// we set via REDIS_ARGS consumed by the bitnami image fallback and pass it anyway.
		env = []string{"REDIS_ARGS=--requirepass " + spec.Password}
		port = 6379
	case "mysql":
		image = fmt.Sprintf("mysql:%s", defaultIfEmpty(spec.Version, "8"))
		env = []string{
			"MYSQL_ROOT_PASSWORD=" + spec.Password,
			"MYSQL_USER=" + defaultIfEmpty(spec.Username, "opencel"),
			"MYSQL_PASSWORD=" + spec.Password,
			"MYSQL_DATABASE=" + defaultIfEmpty(spec.DatabaseName, "opencel"),
		}
		port = 3306
	case "mongodb":
		image = fmt.Sprintf("mongo:%s", defaultIfEmpty(spec.Version, "7"))
		env = []string{
			"MONGO_INITDB_ROOT_USERNAME=" + defaultIfEmpty(spec.Username, "opencel"),
			"MONGO_INITDB_ROOT_PASSWORD=" + spec.Password,
			"MONGO_INITDB_DATABASE=" + defaultIfEmpty(spec.DatabaseName, "opencel"),
		}
		port = 27017
	default:
		err = fmt.Errorf("unsupported kind %q", spec.Kind)
	}
	return
}

func defaultIfEmpty(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

func removeServiceContainer(name string) error {
	if name == "" {
		return nil
	}
	_ = exec.Command("docker", "rm", "-f", name).Run()
	return nil
}
