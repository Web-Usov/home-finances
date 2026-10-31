---
id: T-042
title: "Types: PeriodSchema rejects months outside 01-12, explicit-period transfer test"
status: todo
epic: E-00
depends: [T-025]
blocked_by: []
spec: [API-17, API-18, OP-07, API-21]
acceptance: []
area: api
size: S
branch: null
pr: null
---

# T-042. Types: PeriodSchema rejects months outside 01-12, explicit-period transfer test

## Goal

`2026-13` and `2026-00` are rejected with 422 (not 404 after a DB miss); the transfer balance check (OP-07) with an explicit `period` uses the balances of the target month.

## Context

- `packages/types/src/schemas.ts` `PeriodSchema` (regex only checks the `YYYY-MM` shape).
- `apps/api/src/modules/operations/operations.period.int-spec.ts` (T-025 tests).
- Reviewer follow-up from T-025.

## Definition of Done

- [ ] `it('API-17: period 2026-13 / 2026-00 is rejected with 422')` in types unit tests and an HTTP test for query and body
- [ ] `it('OP-07 / API-21: transfer with explicit period checks the target month balance')` int test (reopened month while another month is open)
- [ ] `pnpm typecheck` green after the types change
- [ ] `pnpm verify` is green
- [ ] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing the error code for other invalid periods.

## Handoff log

<!-- Append-only. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
