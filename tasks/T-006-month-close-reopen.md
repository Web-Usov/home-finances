---
id: T-006
title: Months: close, reopen and draft promotion
status: in_progress
epic: E-01
depends: [T-003]
blocked_by: []
spec: [API-05, API-06, MON-01, MON-02, MON-03, MON-04, MON-07, MON-08, MON-09, MON-10, MON-11, MON-12, MON-13, MON-14, MON-15, FIN-02, CALC-13]
acceptance: [AC-14, AC-15, AC-16, AC-17]
area: api
size: M
branch: task/T-006-month-close-reopen
pr: null
---

# T-006. Months: close, reopen and draft promotion

## Goal

`POST /months/:period/close` and `/reopen` implement the month lifecycle: closing, automatic promotion of an existing draft to open, at most one `reopened` month, reopen preview range and cascade recalculation.

## Context

- Stubs: `months.service.ts` `close` / `reopen` return "Not implemented". `ReopenMonthRequestSchema` exists in `packages/types`; add a close request schema if a `version` is needed (old plan item 17).
- Rules: closing is allowed for any free-funds amount (MON-10) and blocked only by hard invariants (MON-11); draft -> open on closing the current month (MON-08), no draft -> next month is created open per MON-09 only on creation (check `create`); closing a historical reopened month does NOT promote the draft (MON-15).
- Error codes: `INVALID_STATUS_TRANSITION` (409), `MONTH_LOCKED`; add new ones only in `packages/types/src/entities.ts`.
- Reopen response contains the recalculation range (MON-12) so the UI can warn; second concurrent reopen is rejected (MON-13).
- WIP branch has a partial `months.service.ts`; check it first for reusable pieces.

## Definition of Done

- [x] `it('MON-08 / AC-17: closing the current month promotes the existing draft to open')`
- [x] `it('MON-02 / AC-16: a draft accepts operations but cannot be closed')`
- [x] `it('MON-13: a second month cannot be reopened while one is reopened')`
- [x] `it('MON-15: closing a reopened month does not promote the draft')`
- [x] `it('MON-14 / AC-15: reopen recalculates later closed months and keeps their statuses')`
- [x] `it('MON-03 / AC-14: mutations in a closed month return MONTH_LOCKED')`
- [x] Controller uses Zod schemas; no `unknown` DTOs
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- UI buttons and warning dialog (T-009).
- Month creation (already implemented).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Implemented `POST /months/:period/close` and `/reopen` (both body `{ version }`, HTTP 200, response `{ data, warnings }`).

- **close** (API-05): open/reopened -> closed; draft and closed -> 409 `INVALID_STATUS_TRANSITION`; allocations above income -> 422 `ALLOCATION_EXCEEDS_INCOME` (MON-11); free funds / uncovered ops never block (MON-10). Closing an `open` month promotes the existing draft (MON-08); closing a `reopened` one does not (MON-15). Changed months get a `version` bump. No engine run (only statuses change). Response data: `{ month, promotedDraft | null }`.
- **reopen** (API-06): closed -> reopened, second reopened month -> 409 `INVALID_STATUS_TRANSITION` (MON-13), then `recalculateMonthAtomically(id, tx)` in the same transaction (engine bumps versions >= period; later statuses untouched, MON-14). Response data: `{ month, recalcRange: { from, to } }` (to = latest month).
- T-003 review lessons: month read + `version` check now happen inside the transaction (also in `updateIncome`); response schemas declared in Swagger via new Zod schemas in `@family-budget/types` (`MonthSummarySchema`, `mutationResponseSchema`, `CloseMonthResultSchema`, `ReopenMonthResultSchema`, `CloseMonthRequestSchema`), including the existing PATCH income endpoint; generated client is typed. `zodOpenApiSchema` now emits `$refStrategy: 'none'` + `target: 'openApi3'` (inlined schemas, `nullable`), needed for valid OpenAPI when a schema is reused or nullable.

Spec/task notes for the planner:
- The DoD names cite `MON-02` for "a draft cannot be closed", but in the spec draft is `MON-01` (MON-02 is the open status); tests cite MON-01 / AC-16.
- MON-12 asks to show the range *before* reopening, but API-06 only has the reopen call; the range is returned in the response. A preview (GET/dry-run) endpoint would be needed for a pre-confirmation warning in the UI (T-009).
- Spec does not define the error code for a second reopen or closing a draft; `INVALID_STATUS_TRANSITION` used.
- Close ignores operations/negative balances (only FIN-02 checked as the hard invariant).
