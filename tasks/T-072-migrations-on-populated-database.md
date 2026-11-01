---
id: T-072
title: "NFR-29: verify migrations apply on a populated database"
status: in_progress          # todo | in_progress | review | done | blocked
epic: E-06            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [NFR-29]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: api             # api | mobile | infra | docs | design
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-072-migrations-on-populated-database          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-072. NFR-29: verify migrations apply on a populated database

## Goal

A repeatable check proves that all Prisma migrations apply on a database that already contains data created at an older migration baseline, without data loss or errors.

## Context

- `apps/api/prisma/migrations/` (`20260803194137_init`, `20261031120000_single_reopened_month`, ...); NFR-29 (empty and populated DB); `docs/testing.md` (test DB, schema per worker).
- Approach: apply migrations up to the baseline (init) into a scratch schema/database, insert representative rows (months incl. two reopened/open states relevant to `single_reopened_month`, envelopes, allocations, operations), then run `prisma migrate deploy` for the remaining migrations and assert the rows and derived data are intact (and the data-fixing migrations behave). Implement as an integration test using `*.int-spec.ts` or a script runnable in CI (`pnpm test:int` or a new package script wired into `verify`).
- Must not touch the dev DB; use the test DB infrastructure (`apps/api/.env.test`).

## Definition of Done

Every item must be verifiable by a command or a named test.

- [x] `it('NFR-29: migrations apply on a populated database ...')` (or equivalent script) passes: seeded data from the baseline migration survives all later migrations and the resulting schema equals the Prisma schema (`prisma migrate diff` is empty).
- [x] The check also covers the empty database (all migrations from scratch).
- [x] The check runs in CI as part of an existing required job (`verify` or `e2e`/int), documented in `docs/testing.md`.
- [x] `node scripts/spec-check.mjs` shows NFR-29 referenced from a test file.
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Writing new migrations.
- Production backup/restore procedures (SCOPE-17).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Added `apps/api/src/prisma/migrations.populated-db.int-spec.ts` (two `NFR-29` tests, run by `pnpm test:int`/`verify`/CI) and a
section in `docs/testing.md`. Populated case: baseline `init` deployed from a temp copy of the migration folder into its own
schema, realistic data seeded, remaining migrations deployed, data/derived rows/index/drift asserted, engine recalculation
checked against hand-computed values. Empty case: all migrations from scratch.

Notes: `prisma migrate diff` cannot see the MON-13 partial index, so zero drift is expected and the index is asserted via
`pg_indexes`. The seed has no data-fixing migration to exercise yet (`single_reopened_month` only adds an index); extend the
seed when one appears. No new migrations.
