---
id: T-016
title: Delivery: docker compose from scratch and persistence after restart
status: todo
epic: E-06
depends: [T-014]
blocked_by: []
spec: [DOD-01, DOD-04, DOD-05, NFR-03, NFR-04, NFR-17, NFR-29]
acceptance: [AC-22]
area: infra
size: S
branch: null
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

- [ ] Fresh run: `docker compose down -v && docker compose up -d --build` -> API `/api/v1/health` returns 200 and the web client opens
- [ ] Persistence check (script or documented commands): create month + operation, `docker compose restart`, GET shows identical operations, statuses and balances (`AC-22` / `DOD-01`)
- [ ] README documents first run, env variables and reset
- [ ] `.env.example` complete; no secrets committed
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Public hosting (Q-01).
- Authentication (Q-02).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
