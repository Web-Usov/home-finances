#!/usr/bin/env bash
# Installs the preview environment on this host (run as root, re-runnable):
#   scripts/preview/install-systemd.sh [--no-deploy]
# - creates $PREVIEW_HOME (default /root/workspace/finance-preview) and preview.env if missing
# - renders scripts/preview/systemd/*.service|timer into /etc/systemd/system, reloads systemd
# - runs the first deploy (unless --no-deploy or a release already exists), then enables web, api, the 2-minute update timer and the 1-minute health watchdog timer
# Refuses to run from a task worktree (run it from the main checkout).
# Env: PREVIEW_HOME, PREVIEW_REF (written into a NEW preview.env only; used to deploy a branch before it is merged)
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# Refuse to run from a task worktree (its path is removed after the merge, leaving units that point nowhere):
# the toplevel must equal the parent of the shared git dir, i.e. the MAIN checkout.
git_common=$(git -C "$here" rev-parse --path-format=absolute --git-common-dir) || { echo "not inside a git checkout" >&2; exit 1; }
MAIN_DIR=$(dirname "$git_common")
if [ "$(git -C "$here" rev-parse --show-toplevel)" != "$MAIN_DIR" ]; then
  echo "refusing to install from a worktree ($here); run it from the main checkout $MAIN_DIR" >&2
  exit 1
fi
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
PREVIEW_HOME=${PREVIEW_HOME:-/root/workspace/finance-preview}
UNIT_DIR=/etc/systemd/system
NODE_BIN=$(command -v node)
# The updater needs node, pnpm, docker, git, curl; systemd's default PATH lacks the user-level ones.
UNIT_PATH="$(dirname "$NODE_BIN"):/usr/local/bin:/usr/bin:/bin"

mkdir -p "$PREVIEW_HOME/state"
if [ ! -f "$PREVIEW_HOME/preview.env" ]; then
  cat > "$PREVIEW_HOME/preview.env" <<ENV
# Preview environment config (not in git). Read by the systemd units and update.sh.
DATABASE_URL=postgresql://budget:budget@127.0.0.1:5432/family_budget_preview?schema=public
API_PORT=3100
API_HOST=127.0.0.1
WEB_PORT=8100
PREVIEW_HOME=$PREVIEW_HOME
${PREVIEW_REF:+PREVIEW_REF=$PREVIEW_REF}
ENV
  echo "wrote $PREVIEW_HOME/preview.env"
fi

for f in "$here"/systemd/*; do
  sed -e "s#@PREVIEW_HOME@#$PREVIEW_HOME#g" -e "s#@NODE@#$NODE_BIN#g" -e "s#@PATH@#$UNIT_PATH#g" "$f" > "$UNIT_DIR/$(basename "$f")"
  echo "installed $UNIT_DIR/$(basename "$f")"
done
systemctl daemon-reload

if [ "${1:-}" != "--no-deploy" ] && [ ! -L "$PREVIEW_HOME/current" ]; then
  echo "first deploy (several minutes)..."
  PATH="$UNIT_PATH" "$here/update.sh"
fi

systemctl enable --now family-budget-preview-web.service family-budget-preview-api.service
systemctl enable --now family-budget-preview-update.timer family-budget-preview-watchdog.timer
systemctl --no-pager --lines=0 status family-budget-preview-web.service family-budget-preview-api.service family-budget-preview-update.timer family-budget-preview-watchdog.timer || true
