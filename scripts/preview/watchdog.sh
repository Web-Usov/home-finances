#!/usr/bin/env bash
# Preview API health watchdog (idempotent, run every minute by family-budget-preview-watchdog.timer).
# Probes the API health endpoint; after FAIL_THRESHOLD (2) consecutive failures restarts family-budget-preview-api.
# A unit that is `inactive` was stopped on purpose (e.g. DB reset, docs/preview.md), so it is left alone.
# Env (all optional): PREVIEW_HOME, API_PORT, HEALTH_URL, FAIL_THRESHOLD, WATCHDOG_STATE, API_UNIT
set -euo pipefail

PREVIEW_HOME=${PREVIEW_HOME:-/root/workspace/finance-preview}
API_PORT=${API_PORT:-3100}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:$API_PORT/api/v1/health}
FAIL_THRESHOLD=${FAIL_THRESHOLD:-2}
API_UNIT=${API_UNIT:-family-budget-preview-api.service}
STATE_FILE=${WATCHDOG_STATE:-$PREVIEW_HOME/state/watchdog-failures}

log() { echo "watchdog: $*"; }

if curl -fsS -m 5 -o /dev/null "$HEALTH_URL" 2>/dev/null; then
  rm -f "$STATE_FILE"
  exit 0
fi

unit_state=$(systemctl is-active "$API_UNIT" 2>/dev/null || true)
if [ "$unit_state" = inactive ]; then
  rm -f "$STATE_FILE"
  log "$API_UNIT is inactive (stopped on purpose); not restarting"
  exit 0
fi

failures=$(( $(cat "$STATE_FILE" 2>/dev/null || echo 0) + 1 ))
if [ "$failures" -lt "$FAIL_THRESHOLD" ]; then
  echo "$failures" > "$STATE_FILE"
  log "health check failed ($failures/$FAIL_THRESHOLD, unit $unit_state)"
  exit 0
fi

rm -f "$STATE_FILE"
log "health check failed $failures times in a row (unit $unit_state); restarting $API_UNIT"
systemctl reset-failed "$API_UNIT" 2>/dev/null || true
systemctl restart "$API_UNIT"
