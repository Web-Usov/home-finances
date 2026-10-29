#!/usr/bin/env bash
# End-to-end check of the docker-compose deployment: build, migrate, healthy API,
# data survives a restart of api + postgres. Isolated project/ports/volume, always
# torn down. Usage: pnpm smoke:compose
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT="fbsmoke$$"
export SMOKE_API_PORT="${SMOKE_API_PORT:-$(node -e "const s=require('net').createServer().listen(0,()=>{console.log(s.address().port);s.close()})")}"
export SMOKE_DB_PORT="${SMOKE_DB_PORT:-$(node -e "const s=require('net').createServer().listen(0,()=>{console.log(s.address().port);s.close()})")}"
# Ignore any root .env (dev DATABASE_URL etc.); defaults from docker-compose.yml apply.
unset DATABASE_URL POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD API_PORT

DC=(docker compose --project-name "$PROJECT" --env-file /dev/null -f docker-compose.yml -f docker-compose.smoke.yml)
API="http://127.0.0.1:${SMOKE_API_PORT}/api/v1"

cleanup() {
  local code=$?
  if [ "$code" -ne 0 ]; then
    echo "--- smoke:compose FAILED (exit $code); container logs:" >&2
    "${DC[@]}" logs --no-color --tail=60 >&2 || true
  fi
  "${DC[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  exit "$code"
}
trap cleanup EXIT

step() { echo; echo "━━━ $* ━━━"; }

wait_healthy() { # service, timeout seconds
  local svc=$1 deadline=$((SECONDS + $2)) cid status
  while [ "$SECONDS" -lt "$deadline" ]; do
    cid=$("${DC[@]}" ps -q "$svc")
    if [ -n "$cid" ]; then
      status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid")
      [ "$status" = healthy ] && return 0
    fi
    sleep 2
  done
  echo "service $svc did not become healthy in $2s" >&2
  return 1
}

step "project $PROJECT: api :$SMOKE_API_PORT, postgres :$SMOKE_DB_PORT"
step "up --build"
"${DC[@]}" up --build -d --wait --wait-timeout 300

step "health"
curl -fsS "$API/health"; echo

step "create data"
curl -fsS -X POST "$API/months" -H 'Content-Type: application/json' \
  -d '{"period":"2026-01","income":"100000.00"}' >/dev/null
curl -fsS -X POST "$API/envelopes" -H 'Content-Type: application/json' \
  -d '{"name":"Smoke envelope"}' >/dev/null
curl -fsS "$API/envelopes" | grep -q 'Smoke envelope'
curl -fsS "$API/months" | grep -q '2026-01'

step "restart postgres + api"
"${DC[@]}" restart postgres
wait_healthy postgres 60
"${DC[@]}" restart api
wait_healthy api 90

step "data persisted"
curl -fsS "$API/envelopes" | grep -q 'Smoke envelope'
curl -fsS "$API/months" | grep -q '2026-01'

echo; echo "✔ smoke:compose passed"
