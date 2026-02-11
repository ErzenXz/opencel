#!/usr/bin/env sh
set -eu

# OpenCel installer entrypoint.
# This script downloads the `opencel` CLI from GitHub Releases and runs `opencel install`.
#
# Intended usage:
#   curl -fsSL https://raw.githubusercontent.com/ErzenXz/opencel/main/install/install.sh | sh
#
# For now, in-repo usage:
#   sh install/install.sh

REPO="${OPENCEL_INSTALL_REPO:-ErzenXz/opencel}"
VERSION="${OPENCEL_VERSION:-latest}"

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    return 0
  fi
  SUDO=""
  if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  fi
  if [ "$(uname -s)" = "Linux" ] && command -v curl >/dev/null 2>&1; then
    echo "Docker not found. Installing Docker via get.docker.com..."
    curl -fsSL https://get.docker.com | $SUDO sh
  fi
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required but was not found. Install Docker and re-run." >&2
    exit 1
  fi
}

ensure_compose() {
  if docker compose version >/dev/null 2>&1; then
    return 0
  fi
  SUDO=""
  if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  fi
  # Best-effort for Debian/Ubuntu images where docker is present but plugin missing.
  if command -v apt-get >/dev/null 2>&1; then
    echo "Docker Compose plugin not found. Installing docker-compose-plugin..."
    $SUDO apt-get update -y >/dev/null
    $SUDO apt-get install -y docker-compose-plugin >/dev/null
  fi
}

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"

case "$arch" in
  x86_64|amd64) arch="amd64" ;;
  aarch64|arm64) arch="arm64" ;;
  *)
    echo "Unsupported arch: $arch" >&2
    exit 1
    ;;
esac

case "$os" in
  linux|darwin) ;;
  *)
    echo "Unsupported OS: $os" >&2
    exit 1
    ;;
esac

tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

ensure_docker
ensure_compose

asset="opencel_${os}_${arch}.tar.gz"
base_url="https://github.com/${REPO}/releases"

if [ "$VERSION" = "latest" ]; then
  url="${base_url}/latest/download/${asset}"
  sha_url="${base_url}/latest/download/${asset}.sha256"
else
  url="${base_url}/download/${VERSION}/${asset}"
  sha_url="${base_url}/download/${VERSION}/${asset}.sha256"
fi

echo "Downloading OpenCel CLI: ${url}"
curl -fsSL "$url" -o "$tmpdir/$asset"

if curl -fsSL "$sha_url" -o "$tmpdir/$asset.sha256"; then
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$tmpdir" && sha256sum -c "$asset.sha256") || true
  elif command -v shasum >/dev/null 2>&1; then
    # sha file format expected: "<sha>  <filename>"
    (cd "$tmpdir" && shasum -a 256 -c "$asset.sha256") || true
  fi
fi

tar -xzf "$tmpdir/$asset" -C "$tmpdir"

if [ ! -f "$tmpdir/opencel" ]; then
  echo "Downloaded asset did not contain an 'opencel' binary." >&2
  exit 1
fi

install_dir="${OPENCEL_BIN_DIR:-/usr/local/bin}"
if [ ! -d "$install_dir" ]; then
  install_dir="$HOME/.local/bin"
  mkdir -p "$install_dir"
fi
if [ ! -w "$install_dir" ]; then
  install_dir="$HOME/.local/bin"
  mkdir -p "$install_dir"
fi

chmod +x "$tmpdir/opencel"
cp "$tmpdir/opencel" "$install_dir/opencel"

echo "Installed: $install_dir/opencel"
if [ "${OPENCEL_INTERACTIVE:-0}" = "1" ]; then
  if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
    exec sudo "$install_dir/opencel" install --tls auto
  fi
  exec "$install_dir/opencel" install --tls auto
fi
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then
  exec sudo "$install_dir/opencel" install --tls auto --non-interactive
fi
exec "$install_dir/opencel" install --tls auto --non-interactive
