---
id: T-028
title: Enforce a single reopened month in the database (MON-13 race)
status: in_progress
epic: E-00
depends: [T-006]
blocked_by: []
spec: [MON-13, DATA-01, DATA-12]
acceptance: [AC-15]
area: api
size: S
branch: task/T-028-single-reopened-month-db
pr: null
---

# T-028. Enforce a single reopened month in the database (MON-13 race)

## Goal

Two concurrent reopen requests for different closed months cannot both succeed: the database guarantees at most one `reopened` month.

## Context

- Found in the T-006 review: the check in `MonthsService.reopen` is not atomic. Options: a partial unique index `CREATE UNIQUE INDEX ... ON "BudgetMonth"(status) WHERE status = 'reopened'` in a Prisma migration (preferred), or `pg_advisory_xact_lock` around reopen.
- A violation must surface as 409 `INVALID_STATUS_TRANSITION`, not 500.

## Definition of Done

- [ ] `it('MON-13: two concurrent reopens of different months leave exactly one reopened month and one 409 INVALID_STATUS_TRANSITION')` (int-spec) passes
- [ ] Migration applies on a clean DB (`pnpm db:migrate` / `pnpm test:int`)
- [ ] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing the lifecycle rules.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
