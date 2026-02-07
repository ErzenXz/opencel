#!/usr/bin/env bash
set -euo pipefail

# Recovery helper: re-enable SSH access on Ubuntu via console access.
#
# Usage (run as root):
#   bash recover_ssh_ubuntu.sh
#
# Optional:
#   RECOVERY_ALLOW_PASSWORD=1 bash recover_ssh_ubuntu.sh
#
# What it does:
# - ensures openssh-server is installed
# - forces sshd to listen on port 22
# - enables PubkeyAuthentication
# - optionally enables PasswordAuthentication (off by default)
# - allows OpenSSH in UFW if UFW is active

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (or via sudo)." >&2
  exit 1
fi

ALLOW_PASSWORD="${RECOVERY_ALLOW_PASSWORD:-0}"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y openssh-server ufw

RECOVERY_DROPIN="/etc/ssh/sshd_config.d/99-opencel-recovery.conf"
mkdir -p /etc/ssh/sshd_config.d

{
  echo "# OpenCel recovery drop-in (generated $(date -u +%F))"
  echo "Port 22"
  echo "PubkeyAuthentication yes"
  if [[ "$ALLOW_PASSWORD" == "1" ]]; then
    echo "PasswordAuthentication yes"
  fi
} >"$RECOVERY_DROPIN"

sshd -t
systemctl enable --now ssh
systemctl restart ssh

# If UFW is active, ensure SSH is allowed.
if ufw status | grep -q "^Status: active"; then
  ufw allow OpenSSH >/dev/null || true
  ufw reload >/dev/null || true
fi

echo "Recovery applied."
echo "Check:"
echo "  ss -lntp | grep ':22'"
echo "If you used RECOVERY_ALLOW_PASSWORD=1, turn it back off after you add an SSH key."

