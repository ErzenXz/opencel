# OpenCel

**Self-hosted Vercel alternative.** Connect a GitHub repo, push code, get preview URLs and production deploys — on your own VM.

- Push-to-deploy from GitHub (previews per PR, promote to production)
- Built-in build & runtime logs
- Encrypted environment variables
- Managed Postgres / Redis / MySQL / MongoDB on your nodes
- Multi-VM: one control plane, as many worker VMs as you want, grouped by location
- Built-in TLS via Let's Encrypt or Cloudflare Tunnel
- One-command updates (manual or automatic)

---

## Install (one command)

On a fresh Ubuntu/Debian VM with a public IP and a domain pointed at it:

```bash
curl -fsSL https://raw.githubusercontent.com/ErzenXz/opencel/main/install/install.sh | sh
```

That's it. The installer will:

1. Install Docker + Compose if missing.
2. Download the `opencel` CLI to `/usr/local/bin`.
3. Bring up the full stack under `/opt/opencel` with Let's Encrypt TLS.
4. Print the URL to open your dashboard and create the first admin user.

When it finishes, open `https://<your-domain>` and follow the setup wizard.

### Behind Cloudflare Tunnel

If you're running `cloudflared` on the VM (recommended for cheap VPS without opening 80/443):

```bash
curl -fsSL https://raw.githubusercontent.com/ErzenXz/opencel/main/install/install.sh | sh
# then, when the installer asks for TLS mode, choose: cloudflare
```

Or non-interactively:

```bash
sudo opencel install --tls cloudflare --non-interactive \
  --base-domain opencel.example.com \
  --admin-email you@example.com \
  --admin-password 'change-me'
```

Tunnel ingress example lives at [`deploy/cloudflared/config.yml.example`](./deploy/cloudflared/config.yml.example). Point both the base domain and the wildcard (`*.opencel.example.com`) at `http://localhost:80` on the VM.

### Requirements

- Ubuntu 22.04+ / Debian 12+ / similar (x86_64 or arm64)
- A domain name with DNS pointing at the VM
- Root or sudo access
- Ports 80 and 443 open (unless using Cloudflare Tunnel)

---

## Updating

### Run updates manually

```bash
sudo opencel update
```

This pulls new container images and restarts the stack. If pulling fails (e.g. no binary release for your arch), it automatically falls back to building from source on the server.

To also refresh the CLI binary itself:

```bash
sudo opencel update --self
```

### Keep OpenCel up to date automatically

Turn on auto-updates once:

```bash
sudo opencel auto-update enable
```

This installs a systemd timer that runs `opencel update --self` on a schedule (default: daily, with a randomized delay so many servers don't all pull at the same minute).

Check status:

```bash
opencel auto-update status
```

Disable:

```bash
sudo opencel auto-update disable
```

Custom schedule (any [systemd `OnCalendar` expression](https://www.freedesktop.org/software/systemd/man/systemd.time.html#Calendar%20Events)):

```bash
sudo opencel auto-update enable --schedule 'Mon *-*-* 04:00:00'   # every Monday 4am
sudo opencel auto-update enable --schedule hourly
```

---

## Scaling to multiple VMs

OpenCel is multi-VM out of the box. The VM you installed on is the **primary** (control plane + dashboard + one worker). To add more workers:

1. In the dashboard, go to **Locations**, create a location (e.g. *Europe — Frankfurt*), and click **Add node**. Copy the generated join token.
2. On the new VM, install Docker and run:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/ErzenXz/opencel/main/install/install.sh | sh
   sudo opencel join --server https://<your-domain> --token <token-from-dashboard>
   ```

3. The new node appears as `online` in the dashboard within 30 seconds. Deployments and managed services in that location can now be scheduled onto it.

Each worker reports heartbeats every 30s; stale nodes are marked `offline` automatically after 2 minutes.

---

## Using your own fork

If you've forked the repo and want `install` / `update` to pull from your fork:

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-USER/opencel/main/install/install.sh \
  | OPENCEL_INSTALL_REPO=YOUR-USER/opencel sh

sudo opencel update --install-repo YOUR-USER/opencel --self
sudo opencel auto-update enable --install-repo YOUR-USER/opencel
```

---

## Development

Prerequisites: Docker + Compose plugin, Go 1.24+, Node.js 22+.

```bash
# 1. infra
cd deploy/compose/dev
docker compose up -d

# 2. migrations
cd ../../..
go run ./cmd/opencel migrate \
  --dir ./migrations \
  --dsn "postgres://opencel:opencel@localhost:5432/opencel?sslmode=disable"

# 3. api + worker
export OPENCEL_DSN="postgres://opencel:opencel@localhost:5432/opencel?sslmode=disable"
export OPENCEL_REDIS_ADDR="localhost:6379"
export OPENCEL_BASE_DOMAIN="opencel.localhost"
export OPENCEL_ENV_KEY_B64="$(openssl rand -base64 32)"
go run ./apps/api &
go run ./apps/worker &

# 4. dashboard
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000.

### Tests & checks

```bash
go test ./...

cd apps/web
npm run check   # lint + tsc + build
```

### Repo layout

- `apps/api` — Go API service
- `apps/worker` — background worker for deployment tasks
- `apps/web` — Next.js dashboard (shadcn + Tailwind)
- `cmd/opencel` — CLI (`install`, `update`, `auto-update`, `join`, `agent`, `migrate`, `doctor`)
- `deploy/compose` — Docker Compose stacks for local and production installs
- `install/install.sh` — one-line installer
- `docs/` — operational guides (VPS, Cloudflare Tunnel, SSH recovery)

---

## Security

See [SECURITY.md](./SECURITY.md) for reporting vulnerabilities.
