---
id: T-056
title: "Docker hardening: WEB_ROOT, non-root API, watchdog state dir, compose smoke"
status: in_progress
epic: E-00
depends: [T-050]
blocked_by: []
spec: []
acceptance: [AC-22]
area: infra
size: S
branch: task/T-056-docker-hardening-and-compose-smoke
pr: null
---

# T-056. Docker hardening: WEB_ROOT, non-root API, watchdog state dir, compose smoke

## Goal

Small infra follow-ups from the T-016/T-050 reviews, closed with one `pnpm smoke:compose` run after the If-Match change.

## Context

- `scripts/preview/serve-web.mjs`: neutral env name `WEB_ROOT`, keep `PREVIEW_HOME` as an alias (update `docker/web/Dockerfile`, `docs/preview.md`, systemd units and `scripts/__tests__/preview-serve-web.test.mjs`).
- `apps/api/Dockerfile`: run as `USER node` (check ownership of `dist` and prisma engines).
- `scripts/preview/watchdog.sh`: `mkdir -p state` before writing there.
- `pnpm smoke:compose` has not been run since T-050 (If-Match / ETag); a cold run can take ~17 min on this host.

## Definition of Done

- [ ] `WEB_ROOT` is honoured and `PREVIEW_HOME` still works (`pnpm test:scripts`)
- [ ] the API container does not run as root (`docker compose run --rm --entrypoint id api -u` is not 0)
- [ ] watchdog creates `state` when it is missing (test in `scripts/__tests__/`)
- [ ] `pnpm smoke:compose` passes; output summary pasted into Result
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing the delivery topology (ADR 0013).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
