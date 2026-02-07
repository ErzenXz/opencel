# VPS Setup (Cloudflared)

This is the recommended way to run OpenCel on a cheap VPS without exposing 80/443 publicly.

## Prereqs

* Ubuntu 22.04+ (or similar)
* Docker Engine + Compose plugin
* Cloudflare Tunnel already installed and authenticated

## Install From Source (local-build)

```bash
sudo mkdir -p /opt/opencel-src
sudo chown -R $USER:$USER /opt/opencel-src
git clone https://github.com/ErzenXz/opencel.git /opt/opencel-src

cd /opt/opencel-src
go build -o /tmp/opencel ./cmd/opencel
sudo install -m 0755 /tmp/opencel /usr/local/bin/opencel

sudo opencel install \\
  --local-build \\
  --tls cloudflare \\
  --repo /opt/opencel-src \\
  --dir /opt/opencel \\
  --non-interactive \\
  --base-domain opencel.example.com \\
  --admin-email admin@example.com \\
  --admin-password 'change-me'
```

## Cloudflare Tunnel Ingress

Point these hostnames at the VPS:

* `opencel.example.com` -> `http://localhost:80`
* `*.preview.opencel.example.com` -> `http://localhost:80`
* `*.prod.opencel.example.com` -> `http://localhost:80`

Example tunnel config:

* `/Users/erzenkrasniqi/Projects/OpenCel/deploy/cloudflared/config.yml.example`

## Smoke Tests (on VPS)

```bash
# API should be routable through Traefik using the Host header
curl -fsS -H 'Host: opencel.example.com' http://127.0.0.1/api/healthz
```

