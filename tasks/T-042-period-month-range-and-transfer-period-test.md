---
id: T-042
title: "Types: PeriodSchema rejects months outside 01-12, explicit-period transfer test"
status: done
epic: E-00
depends: [T-025]
blocked_by: []
spec: [API-17, API-18, OP-07, API-21]
acceptance: []
area: api
size: S
branch: task/T-042-period-month-range-and-transfer-period-test
pr: https://github.com/Web-Usov/home-finances/pull/48
---

# T-042. Types: PeriodSchema rejects months outside 01-12, explicit-period transfer test

## Goal

`2026-13` and `2026-00` are rejected with 422 (not 404 after a DB miss); the transfer balance check (OP-07) with an explicit `period` uses the balances of the target month.

## Context

- `packages/types/src/schemas.ts` `PeriodSchema` (regex only checks the `YYYY-MM` shape).
- `apps/api/src/modules/operations/operations.period.int-spec.ts` (T-025 tests).
- Reviewer follow-up from T-025.

## Definition of Done

- [x] `it('API-17: period 2026-13 / 2026-00 is rejected with 422')` in types unit tests and an HTTP test for query and body
- [x] `it('OP-07 / API-21: transfer with explicit period checks the target month balance')` int test (reopened month while another month is open)
- [x] `pnpm typecheck` green after the types change
- [x] `pnpm verify` is green
- [x] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing the error code for other invalid periods.

## Handoff log

<!-- Append-only. -->

## Result

- `PeriodSchema` regex now requires month 01-12 (no year limit: the spec sets none). Everything that validates a period through it
  (POST /operations body, GET /operations and /dashboard/monthly queries) answers 422 `VALIDATION_ERROR`.
- Path params `:period` (PATCH/close/reopen/reopen-preview/allocations) now go through a shared `PeriodParamPipe` (422 instead of 404).
  Deviation: `POST /months` body was not validated at all (`@Body()` without a pipe); it now uses `CreateMonthRequestSchema`.
- FirstMonthForm hint now says the month is 01-12. OpenAPI and the generated client regenerated (new pattern).
- Tests: `period-param.pipe.spec.ts` (schema + pipe), `months.period-validation.int-spec.ts`, new cases in `operations.period.int-spec.ts`
  (body/query 422, OP-07 transfer against the target month balance), FirstMonthForm month-13 test.
