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
	// A concurrent DELETE may have flipped us to 'deleting' before we got
	// here; if so, bail out so we don't create a container for a record
	// that's about to be removed.
	if sv.Status == "deleting" {
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
		v, derr := envcrypt.Decrypt(s.Cfg.EncryptKey, sv.PasswordEnc)
		if derr != nil {
			_ = s.Store.UpdateServiceStatus(ctx, sv.ID, "failed", "decrypt service password: "+derr.Error())
			return
		}
		pw = string(v)
	}
	// An empty password would produce an unauthenticated Redis
	// (`--requirepass ""`) and a crash-looping postgres/mysql/mongo that
	// `docker run -d` reports as success. Fail loudly instead.
	if pw == "" {
		_ = s.Store.UpdateServiceStatus(ctx, sv.ID, "failed", "service password is empty")
		return
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
	if n.Role == "primary" {
		info, provErr = runLocalProvision(ctx, spec)
	} else if n.AgentURL.String == "" {
		// A worker that hasn't registered yet has no agent URL. Don't
		// silently fall back to local docker — that would land the
		// container on the control plane while the DB says it's on the
		// worker, and a later delete would try to remove it from the
		// (now-registered) worker and leak the one on the primary.
		_ = s.Store.UpdateServiceStatus(ctx, sv.ID, "failed", "worker node has not registered yet; wait for it to come online")
		return
	} else {
		// Decrypt the node's registration token so we can authenticate to its agent.
		var agentToken string
		if len(n.TokenEnc) > 0 {
			v, derr := envcrypt.Decrypt(s.Cfg.EncryptKey, n.TokenEnc)
			if derr != nil {
				// Token is present but we can't read it — almost always an
				// encrypt-key rotation. Surface the real cause instead of
				// sending the admin to re-create a node whose token is fine.
				_ = s.Store.UpdateServiceStatus(ctx, sv.ID, "failed", "decrypt agent token: "+derr.Error())
				return
			}
			agentToken = string(v)
		}
		if agentToken == "" {
			_ = s.Store.UpdateServiceStatus(ctx, sv.ID, "failed", "missing agent token; re-create the node")
			return
		}
		info, provErr = runRemoteProvision(ctx, n.AgentURL.String, agentToken, spec)
	}
	if provErr != nil {
		_ = s.Store.UpdateServiceStatus(ctx, sv.ID, "failed", provErr.Error())
		return
	}
	// Race: the admin may have hit Delete while we were pulling the image /
	// starting the container. Re-check the status — if the service has been
	// flipped to 'deleting' (or removed), unwind the container we just
	// created instead of stamping it 'running'. Otherwise the delete
	// handler's captured container_name would be empty and the container
	// would outlive its DB record on this node.
	//
	// A transient DB error here is NOT evidence of a delete; treat it
	// optimistically — UpdateServiceRunning will either succeed or also
	// fail, but we must not destroy a freshly created container because
	// of a blip on the control plane's DB connection.
	cur, cerr := s.Store.GetService(ctx, sv.ID)
	if cerr == nil && (cur == nil || cur.Status == "deleting") {
		var rmErr error
		if n.Role != "primary" && n.AgentURL.String != "" {
			var agentToken string
			if len(n.TokenEnc) > 0 {
				if v, derr := envcrypt.Decrypt(s.Cfg.EncryptKey, n.TokenEnc); derr == nil {
					agentToken = string(v)
				} else {
					rmErr = fmt.Errorf("decrypt agent token: %w", derr)
				}
			}
			if rmErr == nil && agentToken == "" {
				// Without a token the agent would 401; sending the
				// request would just mask the orphan with a discarded
				// error.
				rmErr = fmt.Errorf("missing agent token; cannot remove container %s on %s", info.ContainerName, n.AgentURL.String)
			}
			if rmErr == nil {
				rmErr = removeServiceContainerRemote(ctx, n.AgentURL.String, agentToken, info.ContainerName)
			}
		} else {
			rmErr = removeServiceContainer(info.ContainerName)
		}
		if rmErr != nil {
			// Couldn't clean up the container we just created. Keep the
			// row around (status=failed with a clear message) so the
			// admin can retry or intervene manually; deleting here
			// would orphan the container.
			_ = s.Store.UpdateServiceStatus(ctx, sv.ID, "failed", "rollback after concurrent delete failed: "+rmErr.Error())
			return
		}
		if cur != nil {
			_ = s.Store.DeleteService(ctx, sv.ID)
		}
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
	container := containerNameForService(spec.ServiceID, spec.Name)
	image, env, cmdArgs, port, err := imageAndEnvFor(spec)
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
	args = append(args, cmdArgs...)
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

// runRemoteProvision asks a worker node's agent to run a container. It
// authenticates with the node's registration token so arbitrary callers
// cannot drive the agent's docker backend.
func runRemoteProvision(ctx context.Context, agentURL, agentToken string, spec provisionSpec) (db.ServiceRunningInfo, error) {
	body, _ := json.Marshal(spec)
	req, err := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(agentURL, "/")+"/agent/services", bytes.NewReader(body))
	if err != nil {
		return db.ServiceRunningInfo{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+agentToken)
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

// containerNameForService produces a stable, globally-unique container name. The
// DB uniqueness on services is (org_id, name), so we must include the service id
// (a UUID) to avoid collisions across orgs when they land on the same host.
func containerNameForService(serviceID, name string) string {
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

// imageAndEnvFor returns the docker image, env vars, extra command args to
// append after the image, and the service's default port. Redis uses
// command args (not env) because the official redis image only honors
// `--requirepass` when passed as a command argument.
func imageAndEnvFor(spec provisionSpec) (image string, env []string, cmdArgs []string, port int, err error) {
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
		cmdArgs = []string{"redis-server", "--requirepass", spec.Password}
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
	out, err := exec.Command("docker", "rm", "-f", name).CombinedOutput()
	if err != nil {
		// A missing container isn't a real failure — the caller wants the
		// container *gone*, and it already is. Only bail on other errors.
		msg := strings.ToLower(string(out))
		if strings.Contains(msg, "no such container") {
			return nil
		}
		return fmt.Errorf("docker rm %s: %w: %s", name, err, strings.TrimSpace(string(out)))
	}
	return nil
}

// removeServiceContainerRemote asks a worker node's agent to remove a
// container. Mirrors runRemoteProvision's auth: the Bearer token is the
// node's registration token.
func removeServiceContainerRemote(ctx context.Context, agentURL, agentToken, container string) error {
	if strings.TrimSpace(container) == "" || strings.TrimSpace(agentURL) == "" {
		return nil
	}
	body, _ := json.Marshal(map[string]string{"container_name": container})
	req, err := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(agentURL, "/")+"/agent/services/remove", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if agentToken != "" {
		req.Header.Set("Authorization", "Bearer "+agentToken)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("agent remove failed: %d", resp.StatusCode)
	}
	return nil
}
