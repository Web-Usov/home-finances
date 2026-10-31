#!/usr/bin/env bash
# Preview updater (idempotent): deploys PREVIEW_REF (default origin/master) when it differs from the deployed sha.
#
# Layout under $PREVIEW_HOME (default /root/workspace/finance-preview):
#   mirror.git/      bare clone, only fetched here
#   slots/{a,b}/     two detached worktrees (blue/green); `current` points at the live one
#   current          symlink to the live slot (swapped atomically)
#   state/           deployed-sha, failed-sha, last-failure, update.lock
#   preview.env      DATABASE_URL, API_PORT, ... (not in git)
# A build goes into the INACTIVE slot, is smoke-tested on a spare port and only then becomes `current`;
# any failure leaves the running release untouched. Runs at low priority and takes the machine-wide `e2e` lock.
#
# Usage: update.sh [--force]      (--force retries a sha that failed before)
set -Eeuo pipefail

main() {
  PREVIEW_HOME=${PREVIEW_HOME:-/root/workspace/finance-preview}
  if [ -f "$PREVIEW_HOME/preview.env" ]; then set -a; . "$PREVIEW_HOME/preview.env"; set +a; fi
  PREVIEW_REF=${PREVIEW_REF:-origin/master}
  REPO_URL=${PREVIEW_REPO_URL:-git@github.com:Web-Usov/home-finances.git}
  API_PORT=${API_PORT:-3100}
  DB_NAME=${PREVIEW_DB_NAME:-family_budget_preview}
  STATE="$PREVIEW_HOME/state"
  MIRROR="$PREVIEW_HOME/mirror.git"
  mkdir -p "$STATE" "$PREVIEW_HOME/slots"
  : "${DATABASE_URL:?DATABASE_URL must be set in $PREVIEW_HOME/preview.env}"
  # Exact database name (path of the URL up to `?`), never a prefix/suffix match such as `family_budget_preview_test`.
  local url_db=${DATABASE_URL%%\?*}
  url_db=${url_db##*/}
  [ "$url_db" = "$DB_NAME" ] || { echo "refusing: DATABASE_URL database is '$url_db', expected '$DB_NAME'" >&2; exit 2; }
  [ "$DB_NAME" = family_budget_preview ] || { echo "refusing: PREVIEW_DB_NAME must be family_budget_preview" >&2; exit 2; }

  local force=0 locked_target=""
  case "${1:-}" in
    --force) force=1 ;;
    --build) locked_target=$2 ;;
  esac

  if [ -n "$locked_target" ]; then build_and_deploy "$locked_target"; return; fi

  # One updater at a time.
  exec 9>"$STATE/update.lock"
  flock -n 9 || { echo "another update is running, skipping"; return 0; }

  if [ ! -d "$MIRROR" ]; then
    git init -q --bare "$MIRROR"
    git -C "$MIRROR" remote add origin "$REPO_URL"
    git -C "$MIRROR" config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
  fi
  # No --prune: local test refs (refs/remotes/origin/<x>) must survive.
  timeout 120 git -C "$MIRROR" fetch -q origin

  local target deployed failed
  target=$(git -C "$MIRROR" rev-parse --verify "$PREVIEW_REF^{commit}")
  deployed=$(cat "$STATE/deployed-sha" 2>/dev/null || true)
  failed=$(cat "$STATE/failed-sha" 2>/dev/null || true)
  [ "$target" = "$deployed" ] && return 0
  if [ "$target" = "$failed" ] && [ "$force" = 0 ]; then
    echo "$target failed to deploy earlier (see $STATE/last-failure); fix master or run update.sh --force"
    return 0
  fi
  if ! git -C "$MIRROR" cat-file -e "$target:scripts/preview/update.sh" 2>/dev/null; then
    echo "$PREVIEW_REF ($target) has no scripts/preview/update.sh; keeping the current release"
    return 0
  fi

  echo "deploying $target (was ${deployed:-none}) from $PREVIEW_REF"
  # Heavy build: wait for the machine-wide lock shared with e2e runs, at idle CPU/IO priority.
  git -C "$MIRROR" show "$target:scripts/with-lock.mjs" > "$STATE/with-lock.mjs"
  rm -f "$STATE/build-started"
  if nice -n 19 ionice -c3 node "$STATE/with-lock.mjs" e2e -- nice -n 19 ionice -c3 "$0" --build "$target"; then
    rm -f "$STATE/failed-sha"
  elif [ ! -f "$STATE/build-started" ]; then
    # The build never began: the lock wait timed out (or with-lock failed). Not the sha's fault, so retry on the next tick.
    echo "could not get the e2e lock for $target; will retry on the next run" >&2
    return 1
  else
    echo "$target" > "$STATE/failed-sha"
    echo "FAILED deploying $target; previous release ($deployed) keeps running" >&2
    return 1
  fi
}

step() { CURRENT_STEP=$*; echo "── $(date -Is) $*"; }

fail() { # called by the ERR trap inside the build process
  local code=$?
  printf '{"sha":"%s","step":"%s","exitCode":%s,"at":"%s"}\n' "$TARGET" "$CURRENT_STEP" "$code" "$(date -Is)" > "$STATE/last-failure"
  echo "build of $TARGET failed at step: $CURRENT_STEP (exit $code)" >&2
  exit "$code"
}

wait_health() { # port, seconds
  local deadline=$((SECONDS + $2))
  while [ "$SECONDS" -lt "$deadline" ]; do
    curl -fsS -o /dev/null "http://127.0.0.1:$1/api/v1/health" 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

build_and_deploy() {
  TARGET=$1
  CURRENT_STEP=start
  trap fail ERR
  : > "$STATE/build-started" # tells the caller that the lock was acquired and the build began
  export LEFTHOOK=0 CI=1 NODE_ENV=development # devDependencies are needed to build; NODE_ENV=production is only for runtime

  local active="" slot previous_link="" dir
  if [ -L "$PREVIEW_HOME/current" ]; then
    previous_link=$(readlink -f "$PREVIEW_HOME/current")
    active=$(basename "$previous_link")
  fi
  if [ "$active" = a ]; then slot=b; else slot=a; fi
  dir="$PREVIEW_HOME/slots/$slot"

  step "checkout $TARGET into slot $slot"
  if [ -d "$dir" ]; then
    git -C "$dir" checkout -q -f --detach "$TARGET"
  else
    git -C "$MIRROR" worktree prune
    git -C "$MIRROR" worktree add -q --detach "$dir" "$TARGET"
  fi
  rm -rf "$dir/.preview"
  mkdir -p "$dir/.preview"

  step "ensure database $DB_NAME"
  if ! docker exec family-budget-db psql -U budget -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
    docker exec family-budget-db psql -U budget -d postgres -c "CREATE DATABASE $DB_NAME"
  fi

  cd "$dir"
  step "pnpm install"
  pnpm install --frozen-lockfile --prefer-offline
  step "build types + api"
  pnpm --filter @family-budget/types build
  pnpm --filter @family-budget/api build
  step "expo export web (same-origin API)"
  (cd apps/mobile && EXPO_PUBLIC_API_URL=same-origin pnpm exec expo export --clear --platform web --output-dir "$dir/.preview/web")
  [ -f "$dir/.preview/web/index.html" ]

  step "prisma migrate deploy"
  (cd apps/api && pnpm exec prisma migrate deploy)

  step "write version.json"
  node -e '
    const [sha, subject, builtAt] = process.argv.slice(1);
    require("fs").writeFileSync(".preview/version.json", JSON.stringify({ sha, short: sha.slice(0, 7), subject, builtAt }, null, 2) + "\n");
  ' "$TARGET" "$(git -C "$dir" log -1 --format=%s "$TARGET")" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  step "smoke test the new build on a spare port"
  local spare=$((API_PORT + 99)) pid
  (cd apps/api && API_PORT=$spare NODE_ENV=production node dist/main.js >"$STATE/smoke.log" 2>&1) &
  pid=$!
  if ! wait_health "$spare" 40; then
    kill "$pid" 2>/dev/null || true
    tail -20 "$STATE/smoke.log" >&2
    false
  fi
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true

  step "swap current -> slot $slot and restart api"
  trap - ERR
  ln -sfn "$dir" "$PREVIEW_HOME/current.tmp"
  mv -T "$PREVIEW_HOME/current.tmp" "$PREVIEW_HOME/current"
  if systemctl restart family-budget-preview-api.service && wait_health "$API_PORT" 40; then
    systemctl start family-budget-preview-web.service || true
  else
    echo "new release did not start healthy; rolling back" >&2
    CURRENT_STEP="restart/health check after swap"
    printf '{"sha":"%s","step":"%s","at":"%s"}\n' "$TARGET" "$CURRENT_STEP" "$(date -Is)" > "$STATE/last-failure"
    if [ -n "$previous_link" ]; then
      ln -sfn "$previous_link" "$PREVIEW_HOME/current.tmp"
      mv -T "$PREVIEW_HOME/current.tmp" "$PREVIEW_HOME/current"
      systemctl restart family-budget-preview-api.service || true
      wait_health "$API_PORT" 40 || echo "WARNING: previous release is not healthy after rollback either" >&2
    fi
    exit 1
  fi
  echo "$TARGET" > "$STATE/deployed-sha"
  echo "✔ deployed $TARGET ($(git -C "$dir" log -1 --format=%s "$TARGET"))"
}

main "$@"
exit $?
