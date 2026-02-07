# OpenCel

OpenCel is an open source, self-hosted deployment platform inspired by Vercel:

* Connect a GitHub repo
* Build and deploy on push/PR
* Preview URLs per deployment
* Promote a deployment to Production
* View build/runtime logs

This repository currently targets **single-host Docker Compose** for v1.

## Quickstart (dev)

Prereqs:
* Docker Desktop / Docker Engine + Compose plugin
* Go (1.22+)
* Node.js (20+)

Start the dev stack:

```bash
cd deploy/compose/dev
docker compose up -d
```

Run DB migrations:

```bash
go run ./cmd/opencel migrate --dir ./migrations --dsn "postgres://opencel:opencel@localhost:5432/opencel?sslmode=disable"
```

Run API + Worker locally:

```bash
export OPENCEL_DSN="postgres://opencel:opencel@localhost:5432/opencel?sslmode=disable"
export OPENCEL_REDIS_ADDR="localhost:6379"
export OPENCEL_BASE_DOMAIN="opencel.localhost"
export OPENCEL_ENV_KEY_B64="$(openssl rand -base64 32)"

go run ./apps/api
go run ./apps/worker
```

Run dashboard:

```bash
cd apps/web
npm install
npm run dev
```

## Install (production-ish)

The v1 goal is a single curl installer:

```bash
curl -fsSL https://get.opencel.sh | sh
```

In this repo, the installer is `install/install.sh` and expects release assets
to exist (CI wires that up).

## Cloudflare Tunnel (recommended for VPS)

If you are running behind `cloudflared`, use the installer TLS mode:

```bash
opencel install --tls cloudflare
```

And configure Cloudflare Tunnel ingress to route the base domain + wildcard preview/prod
to the server's port 80. Example config:

* `/Users/erzenkrasniqi/Projects/OpenCel/deploy/cloudflared/config.yml.example`
