# OpenCel

OpenCel is an open source, self-hosted deployment platform inspired by Vercel.

## What OpenCel does today

- Connect a GitHub repository to a project
- Build and deploy on push or pull request
- Create preview URLs per deployment
- Promote a deployment to production
- Stream build/runtime logs in the dashboard
- Manage encrypted environment variables

The current target is single-host Docker Compose for v1.

## Monorepo layout

- `apps/api` - Go API service
- `apps/worker` - background worker for deployment tasks
- `apps/web` - Next.js dashboard (shadcn + Tailwind)
- `cmd/opencel` - OpenCel CLI (`install`, `migrate`, and tooling)
- `deploy/compose` - Docker Compose stacks for local/prod-style installs

## Quickstart (development)

Prerequisites:

- Docker Desktop / Docker Engine + Compose plugin
- Go `1.24+`
- Node.js `22+`

Start infrastructure:

```bash
cd deploy/compose/dev
docker compose up -d
```

Run DB migrations:

```bash
go run ./cmd/opencel migrate --dir ./migrations --dsn "postgres://opencel:opencel@localhost:5432/opencel?sslmode=disable"
```

Run API and worker locally:

```bash
export OPENCEL_DSN="postgres://opencel:opencel@localhost:5432/opencel?sslmode=disable"
export OPENCEL_REDIS_ADDR="localhost:6379"
export OPENCEL_BASE_DOMAIN="opencel.localhost"
export OPENCEL_ENV_KEY_B64="$(openssl rand -base64 32)"

go run ./apps/api
go run ./apps/worker
```

Run the dashboard:

```bash
cd apps/web
npm install
npm run dev
```

## Validation commands

Repository checks:

```bash
go test ./...
```

Web checks:

```bash
cd apps/web
npm run check
```

## Install (production-style)

Install directly from GitHub (no custom domain required):

```bash
curl -fsSL https://raw.githubusercontent.com/ErzenXz/opencel/main/install/install.sh | sh
```

In-repo installer entrypoint:

```bash
sh install/install.sh
```

`install/install.sh` downloads a released `opencel` binary and runs `opencel install`.

## Updating OpenCel on a VPS

After installing, update services in-place with:

```bash
sudo opencel update
```

This runs `docker compose pull` and `docker compose up -d` in `/opt/opencel`.

If you also want to refresh the CLI binary itself first:

```bash
sudo opencel update --self
```

If your VPS currently has an older `opencel` binary that does not include `update`, run the installer once:

```bash
curl -fsSL https://raw.githubusercontent.com/ErzenXz/opencel/main/install/install.sh | sh
```

Then use `opencel update` for future updates.

If you install from your own GitHub fork, set the release repo:

```bash
curl -fsSL https://raw.githubusercontent.com/ErzenXz/opencel/main/install/install.sh | OPENCEL_INSTALL_REPO=ErzenXz/opencel sh
```

## Cloudflare Tunnel (recommended for VPS)

If running behind `cloudflared`, use the installer TLS mode:

```bash
opencel install --tls cloudflare
```

Use the tunnel config example at `deploy/cloudflared/config.yml.example` and route both the base domain and wildcard preview/prod domains to port `80` on your server.
