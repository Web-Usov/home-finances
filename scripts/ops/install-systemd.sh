#!/usr/bin/env bash
# Installs the ops timers on this host (run as root, re-runnable):
#   scripts/ops/install-systemd.sh
# Renders scripts/ops/systemd/*.service|timer into /etc/systemd/system, reloads systemd and enables the 2-minute timer.
# The units run scripts from the checkout this installer lives in; install from a stable checkout (the main one on master),
# not from a task worktree that gets removed. Needs `gh` authenticated for root (/root/.config/gh).
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
REPO_DIR=$(cd "$here/../.." && pwd)
UNIT_DIR=/etc/systemd/system
GH_BIN=$(command -v gh) || { echo "gh not found" >&2; exit 1; }
# systemd's default PATH lacks user-level tools; the script needs gh, jq and bash.
UNIT_PATH="$(dirname "$GH_BIN"):/usr/local/bin:/usr/bin:/bin"

gh auth status >/dev/null 2>&1 || { echo "gh is not authenticated for root (run: gh auth login)" >&2; exit 1; }

for f in "$here"/systemd/*; do
  sed -e "s#@REPO_DIR@#$REPO_DIR#g" -e "s#@PATH@#$UNIT_PATH#g" "$f" > "$UNIT_DIR/$(basename "$f")"
  echo "installed $UNIT_DIR/$(basename "$f")"
done
systemctl daemon-reload
systemctl enable --now family-budget-auto-update-prs.timer
systemctl --no-pager --lines=0 status family-budget-auto-update-prs.timer || true
