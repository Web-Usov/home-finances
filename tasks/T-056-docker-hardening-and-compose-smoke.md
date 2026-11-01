---
id: T-056
title: "Docker hardening: WEB_ROOT, non-root API, watchdog state dir, compose smoke"
status: done
epic: E-00
depends: [T-050]
blocked_by: []
spec: []
acceptance: [AC-22]
area: infra
size: S
branch: task/T-056-docker-hardening-and-compose-smoke
pr: https://github.com/Web-Usov/home-finances/pull/55
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

- [x] `WEB_ROOT` is honoured and `PREVIEW_HOME` still works (`pnpm test:scripts`)
- [x] the API container does not run as root (`docker compose run --rm --entrypoint id api -u` is not 0)
- [x] watchdog creates `state` when it is missing (test in `scripts/__tests__/`)
- [x] `pnpm smoke:compose` passes; output summary pasted into Result
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing the delivery topology (ADR 0013).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

- `serve-web.mjs`: `WEB_ROOT=<dir>` serves a plain export (`/version.json` = `$WEB_ROOT/version.json`); `PREVIEW_HOME` keeps the
  `current/.preview/web` layout and is unchanged for the systemd units (no unit re-install needed, so the live preview is unaffected). `WEB_ROOT` wins when both are set.
- `docker/web/Dockerfile`: `WEB_ROOT=/srv/web`, the `current` symlink / nested `.preview` tree is gone.
- `apps/api/Dockerfile`: `USER node` (uid 1000: `docker compose run --rm --entrypoint id api -u` prints `1000`); files stay root-owned and read-only for the app, prisma client/engines are only read at runtime.
- `watchdog.sh`: `mkdir -p` of the state dir before writing the counter (test added).
- `pnpm smoke:compose` (isolated project `fbsmoke1175646`, free ports): build, migrate, API healthy, web + proxy health, web index served, month/envelopes/expense/transfer created, whole stack restarted, operations/statuses/balances identical after restart: `smoke:compose passed` (exit 0).
