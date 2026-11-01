---
id: T-016
title: Delivery: docker compose from scratch and persistence after restart
status: in_progress
epic: E-06
depends: [T-014]
blocked_by: []
spec: [DOD-01, DOD-04, DOD-05, NFR-03, NFR-04, NFR-17, NFR-29]
acceptance: [AC-22]
area: infra
size: S
branch: task/T-016-docker-compose-e2e
pr: null
---

# T-016. Delivery: docker compose from scratch and persistence after restart

## Goal

On a clean machine `docker compose up -d --build` brings up database, migrated API and the web client with a documented first-run procedure; data (operations, statuses, balances) survives a restart of the stack.

## Context

- `docker-compose.yml` (PostgreSQL 16 with volume `postgres_data` + API image); `apps/api/Dockerfile`. Known issue: healthcheck must hit `/api/v1/health`.
- The web client is not yet in compose: decide serving (static Expo web export behind a small server or an additional service) and document the choice in the Result section; add an ADR proposal for the planner if architecture changes.
- Migrations must run on start (`prisma migrate deploy`); `.env.example` must list all variables (DOD-05); README gets a first-run section.
- A `smoke:compose` script (owned by tooling) may exist: reuse it if present, otherwise add a script under `scripts/` (not package.json).

## Definition of Done

- [x] Fresh run: `docker compose down -v && docker compose up -d --build` -> API `/api/v1/health` returns 200 and the web client opens
- [x] Persistence check (script or documented commands): create month + operation, `docker compose restart`, GET shows identical operations, statuses and balances (`AC-22` / `DOD-01`)
- [x] README documents first run, env variables and reset
- [x] `.env.example` complete; no secrets committed
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)
- [x] Infra follow-ups: watchdog `set -euo pipefail`; preview.md reorder + watchdog in stop list; installers refuse worktrees; auto-update-prs exit codes + tests

## Out of scope

- Public hosting (Q-01).
- Authentication (Q-02).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

**Compose design.** `docker compose up -d --build` starts `postgres` -> `migrate` (one-shot `prisma migrate deploy`) -> `api` (healthcheck `/api/v1/health`) -> `web`.
`web` is a new service (`docker/web/Dockerfile`, context = repo root): stage 1 runs `expo export --platform web` with
`EXPO_PUBLIC_API_URL=same-origin`; stage 2 is `node:20-alpine` running the existing `scripts/preview/serve-web.mjs` unchanged
(SPA fallback, `/api` reverse proxy to `http://api:3000`). The script is reused through its `PREVIEW_HOME/current/.preview/web` layout
(image sets `PREVIEW_HOME=/srv/web` and a `current` symlink). Decision: reuse instead of nginx - no new tool or config, same
behaviour as the owner's preview, and one public port (8080) means no CORS. Host ports are env-configurable
(`POSTGRES_PORT`, `API_HOST_PORT`, `WEB_HOST_PORT`); `.dockerignore` no longer excludes `apps/mobile` (needed by the web build).

**Persistence.** `scripts/smoke-compose.sh` (`pnpm smoke:compose`) now: up --build, health direct + via web proxy, web index served,
creates month + 2 envelopes + expense + transfer, snapshots operations/months/envelopes/dashboard, `docker compose restart` of the
whole stack, byte-identical snapshot required (AC-22 / DOD-01). Isolated project name and free ports, torn down incl. volume.

**ADR proposal for the planner (no ADR edited).** Record "Delivery topology: single compose stack with a same-origin web container
(static Expo export served by serve-web.mjs, /api proxied to the api service); no CORS configuration, no nginx". The architecture
itself (API, client, DB) is unchanged, so this is a documentation-level ADR only.

**Follow-ups done.** (a) watchdog.sh `set -euo pipefail`; (b) docs/preview.md reordered, watchdog timer in the stop list;
(c) both install-systemd.sh refuse to run from a worktree (toplevel must equal the parent of `git --git-common-dir`), test
`scripts/__tests__/install-systemd.test.mjs`; (d) auto-update-prs.sh processes all PRs, then exits 1 if any update-branch failed,
fails on jq/gh errors (no process substitution), tests added.

**Deviations / notes.** Not covered: the browser rendering of the web container (checked index + proxy only; e2e covers the app
itself). Cold `smoke:compose` took ~17 min on this loaded host.
