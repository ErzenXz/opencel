#!/usr/bin/env bash
set -euo pipefail

# Bootstraps a fresh Ubuntu VPS for OpenCel behind Cloudflare Tunnel.
# Assumes cloudflared is already installed and authenticated.
#
# Usage (as a sudo-capable user):
#   BASE_DOMAIN=opencel.example.com ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='change-me' ./scripts/vps/setup_cloudflared_ubuntu.sh
#
# This script:
# - installs Docker Engine + Compose plugin
# - clones the OpenCel repo
# - builds the opencel CLI using a Go build container (so host Go is not required)
# - runs `opencel install` in cloudflare mode (HTTP origin)

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as a normal user with sudo, not as root." >&2
  exit 1
fi

BASE_DOMAIN="${BASE_DOMAIN:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
REPO_URL="${REPO_URL:-https://github.com/ErzenXz/opencel.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/opencel}"
SRC_DIR="${SRC_DIR:-/opt/opencel-src}"

if [[ -z "$BASE_DOMAIN" || -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  echo "Missing env vars: BASE_DOMAIN, ADMIN_EMAIL, ADMIN_PASSWORD" >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release git

sudo install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
fi
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker "$USER" || true

sudo mkdir -p "$SRC_DIR"
sudo chown -R "$USER:$USER" "$SRC_DIR"

if [[ ! -d "$SRC_DIR/.git" ]]; then
  git clone "$REPO_URL" "$SRC_DIR"
else
  (cd "$SRC_DIR" && git pull --ff-only)
fi

TMP_BIN="$(mktemp -d)/opencel"
sudo docker run --rm -v "$SRC_DIR:/src" -w /src golang:1.24-alpine \
  sh -lc "apk add --no-cache git ca-certificates >/dev/null && go build -trimpath -ldflags='-s -w' -o /out/opencel ./cmd/opencel && cp /out/opencel /src/.opencel-cli"

sudo install -m 0755 "$SRC_DIR/.opencel-cli" /usr/local/bin/opencel

sudo opencel install \
  --local-build \
  --tls cloudflare \
  --repo "$SRC_DIR" \
  --dir "$INSTALL_DIR" \
  --non-interactive \
  --base-domain "$BASE_DOMAIN" \
  --admin-email "$ADMIN_EMAIL" \
  --admin-password "$ADMIN_PASSWORD"

echo ""
echo "OpenCel installed. Smoke test:"
echo "  curl -fsS -H 'Host: $BASE_DOMAIN' http://127.0.0.1/api/healthz"
