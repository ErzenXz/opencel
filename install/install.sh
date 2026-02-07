#!/usr/bin/env sh
set -eu

# OpenCel installer entrypoint.
# This script downloads the `opencel` CLI from GitHub Releases and runs `opencel install`.
#
# Intended usage:
#   curl -fsSL https://get.opencel.sh | sh
#
# For now, in-repo usage:
#   sh install/install.sh

REPO="${OPENCEL_INSTALL_REPO:-opencel/opencel}"
VERSION="${OPENCEL_VERSION:-latest}"

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

chmod +x "$tmpdir/opencel"
cp "$tmpdir/opencel" "$install_dir/opencel"

echo "Installed: $install_dir/opencel"
exec "$install_dir/opencel" install
