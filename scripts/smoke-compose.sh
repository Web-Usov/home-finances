#!/usr/bin/env bash
# End-to-end check of the docker-compose deployment: build, migrate, healthy API,
# data survives a restart of api + postgres. Isolated project/ports/volume, always
# torn down. Usage: pnpm smoke:compose
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT="fbsmoke$$"
free_port() { node -e "const s=require('net').createServer().listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})"; }
export API_HOST_PORT="${SMOKE_API_PORT:-$(free_port)}"
export POSTGRES_PORT="${SMOKE_DB_PORT:-$(free_port)}"
export WEB_HOST_PORT="${SMOKE_WEB_PORT:-$(free_port)}"
# Ignore any root .env (dev DATABASE_URL etc.); defaults from docker-compose.yml apply.
unset DATABASE_URL POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD API_PORT

DC=(docker compose --project-name "$PROJECT" --env-file /dev/null -f docker-compose.yml -f docker-compose.smoke.yml)
API="http://127.0.0.1:${API_HOST_PORT}/api/v1"
WEB="http://127.0.0.1:${WEB_HOST_PORT}"
SNAP_DIR=$(mktemp -d)

cleanup() {
  local code=$?
  if [ "$code" -ne 0 ]; then
    echo "--- smoke:compose FAILED (exit $code); container logs:" >&2
    "${DC[@]}" logs --no-color --tail=60 >&2 || true
  fi
  "${DC[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$SNAP_DIR"
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

post() { curl -fsS -X POST "$API$1" -H 'Content-Type: application/json' ${3:+-H "If-Match: \"$3\""} -d "$2"; }
json() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log($1)})"; }

# Operations (incl. result rows), month list (statuses, versions) and the dashboard (balances), verbatim.
snapshot() { # target file
  { curl -fsS "$API/operations?period=2026-01"; echo
    curl -fsS "$API/months"; echo
    curl -fsS "$API/envelopes"; echo
    curl -fsS "$API/dashboard/monthly?period=2026-01"; echo; } > "$1"
}

step "project $PROJECT: api :$API_HOST_PORT, web :$WEB_HOST_PORT, postgres :$POSTGRES_PORT"
step "up --build (postgres + migrate + api + web)"
"${DC[@]}" up --build -d --wait --wait-timeout 600

step "migrate works offline (T-071): re-run it on an internal network with no outbound route"
OFFLINE_OUT=$("${DC[@]}" --profile offline run --rm --no-deps migrate-offline 2>&1) || { echo "$OFFLINE_OUT" >&2; exit 1; }
echo "$OFFLINE_OUT" | tail -3
echo "$OFFLINE_OUT" | grep -q 'No pending migrations to apply'
! echo "$OFFLINE_OUT" | grep -qi -e corepack -e 'Corepack is about to download'
echo "migrate ran offline, nothing downloaded"

step "health (api direct and through the web proxy), web client"
curl -fsS "$API/health"; echo
curl -fsS "$WEB/api/v1/health"; echo
curl -fsS "$WEB/" | grep -q '<div id="root"'
echo "web index served"

step "create data: month + envelopes + expense (partially covered) + transfer"
post /months '{"period":"2026-01","income":"100000.00"}' >/dev/null
FOOD=$(post /envelopes '{"name":"Smoke food","initialBalance":"5000.00"}' | json 'j.envelope.id')
SAVE=$(post /envelopes '{"name":"Smoke savings","initialBalance":"20000.00"}' | json 'j.envelope.id')
version() { curl -fsS "$API/months" | json "j.months.find(m=>m.period==='2026-01').version"; }
# The expected month version travels in `If-Match: "<version>"` (API-25), the third argument of post().
post /operations "{\"type\":\"expense\",\"sourceEnvelopeId\":\"$FOOD\",\"amount\":\"7000.50\",\"comment\":\"Smoke expense\"}" "$(version)" >/dev/null
post /operations "{\"type\":\"transfer\",\"sourceEnvelopeId\":\"$SAVE\",\"destinationEnvelopeId\":\"$FOOD\",\"amount\":\"1500.00\",\"comment\":\"Smoke transfer\"}" "$(version)" >/dev/null
snapshot "$SNAP_DIR/before.json"
grep -q 'Smoke expense' "$SNAP_DIR/before.json"
grep -q 'Smoke transfer' "$SNAP_DIR/before.json"
echo "snapshot before: $(wc -c < "$SNAP_DIR/before.json") bytes"

step "restart the whole stack (AC-22 / DOD-01)"
"${DC[@]}" restart
wait_healthy postgres 60
wait_healthy api 90
wait_healthy web 60

step "operations, statuses and balances are identical after the restart"
snapshot "$SNAP_DIR/after.json"
diff "$SNAP_DIR/before.json" "$SNAP_DIR/after.json"
curl -fsS "$WEB/api/v1/operations?period=2026-01" | grep -q 'Smoke expense'

echo; echo "✔ smoke:compose passed"
