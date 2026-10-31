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

- [ ] `it('MON-08 / AC-17: closing the current month promotes the existing draft to open')`
- [ ] `it('MON-02 / AC-16: a draft accepts operations but cannot be closed')`
- [ ] `it('MON-13: a second month cannot be reopened while one is reopened')`
- [ ] `it('MON-15: closing a reopened month does not promote the draft')`
- [ ] `it('MON-14 / AC-15: reopen recalculates later closed months and keeps their statuses')`
- [ ] `it('MON-03 / AC-14: mutations in a closed month return MONTH_LOCKED')`
- [ ] Controller uses Zod schemas; no `unknown` DTOs
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- UI buttons and warning dialog (T-009).
- Month creation (already implemented).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
