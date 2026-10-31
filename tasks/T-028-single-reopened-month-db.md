---
id: T-028
title: Enforce a single reopened month in the database (MON-13 race)
status: done
epic: E-00
depends: [T-006]
blocked_by: []
spec: [MON-13, DATA-01, DATA-12]
acceptance: [AC-15]
area: api
size: S
branch: task/T-028-single-reopened-month-db
pr: https://github.com/Web-Usov/home-finances/pull/36
---

# T-028. Enforce a single reopened month in the database (MON-13 race)

## Goal

Two concurrent reopen requests for different closed months cannot both succeed: the database guarantees at most one `reopened` month.

## Context

- Found in the T-006 review: the check in `MonthsService.reopen` is not atomic. Options: a partial unique index `CREATE UNIQUE INDEX ... ON "BudgetMonth"(status) WHERE status = 'reopened'` in a Prisma migration (preferred), or `pg_advisory_xact_lock` around reopen.
- A violation must surface as 409 `INVALID_STATUS_TRANSITION`, not 500.

## Definition of Done

- [x] `it('MON-13: two concurrent reopens of different months leave exactly one reopened month and one 409 INVALID_STATUS_TRANSITION')` (int-spec) passes
- [x] Migration applies on a clean DB (`pnpm db:migrate` / `pnpm test:int`)
- [x] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing the lifecycle rules.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Partial unique index `budget_month_single_reopened_key` on `budget_month(status) WHERE status = 'reopened'`
(migration `20261031120000_single_reopened_month`, `IF NOT EXISTS`, not modelled in schema.prisma). `MonthsService.reopen`
maps a P2002 on that index (and only that one, `reopen-violation.ts`) to 409 `INVALID_STATUS_TRANSITION`; the T-036 lock-based
check stays. Tests: `months.reopen-unique.int-spec.ts` (DB-level rejection on insert and update), `months.service.spec.ts`
(mapping, other P2002 rethrown); the concurrent-reopen race is already covered by `month-lock.concurrency.same-kind.int-spec.ts`.
Migration verified on a scratch schema holding existing data with one reopened month, applied twice. No API/contract change.
