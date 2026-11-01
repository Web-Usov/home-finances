---
id: T-071
title: "Docker: migrate service must run offline (corepack cache readable by USER node)"
status: in_progress          # todo | in_progress | review | done | blocked
epic: E-06            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [DOD-04, DOD-05]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: infra             # api | mobile | infra | docs | design
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-071-docker-migrate-offline-corepack          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-071. Docker: migrate service must run offline (corepack cache readable by USER node)

## Goal

The compose `migrate` service applies migrations without network access: it no longer downloads pnpm at start because the corepack cache was prepared as root.

## Context

- `apps/api/Dockerfile` production stage: `corepack prepare pnpm@9.15.0 --activate` runs as root (cache in `/root/.cache`), the image then runs `USER node`, so `pnpm exec prisma migrate deploy` (compose `migrate` command) re-downloads pnpm and fails offline (found in T-056 review).
- Fix options: set `COREPACK_HOME` to a world-readable path (e.g. `/opt/corepack`) before `corepack prepare`, or make `migrate` run `node_modules/.bin/prisma migrate deploy` (or `node ... prisma`) directly without pnpm. Pick the smaller one; keep `corepack enable` for the web image consistent if it has the same issue (`docker/web/Dockerfile`).
- `scripts/smoke-compose.sh`, `docker-compose.yml`, `docs/testing.md` (compose smoke).

## Definition of Done

Every item must be verifiable by a command or a named test.

- [x] Running the `migrate` container with the network disabled (e.g. `docker compose run --rm --no-deps --network none`-style check with a reachable DB, or an equivalent documented procedure) applies migrations successfully; the exact command is written into `scripts/smoke-compose.sh` or `docs/testing.md`. If a network-less run is not feasible in CI, document why and verify manually, noting the result in `## Result`.
- [x] `docker compose build` and `pnpm smoke:compose` are green.
- [x] No pnpm/corepack download is attempted at container start (verified by the offline run).
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing the migration set or Prisma version.
- Changing the API runtime command.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Approach: `migrate` now runs `node_modules/.bin/prisma migrate deploy` directly (WORKDIR `/app/apps/api`); the runtime
no longer touches pnpm/corepack. Chosen over `COREPACK_HOME=/opt/corepack` because it removes the runtime dependency
instead of relocating a cache (smaller, no extra image state). `apps/api/Dockerfile` is unchanged (corepack is still used at build time).
`docker/web/Dockerfile` has no issue: its runtime is plain `node serve-web.mjs`, pnpm is only used in the builder stage.

Offline proof: `docker-compose.smoke.yml` adds service `migrate-offline` (same image/command) on an `internal: true` network that
reaches postgres but has no outbound route; `scripts/smoke-compose.sh` runs it right after `up` and requires
"No pending migrations to apply" and no corepack output. Manual control on the built image with `--network none`:
`node_modules/.bin/prisma --version` works; the old `pnpm exec prisma --version` fails with "Corepack is about to download ...pnpm-9.15.0.tgz".
`pnpm smoke:compose` passed (isolated project, free ports). Documented in `docs/testing.md`.
