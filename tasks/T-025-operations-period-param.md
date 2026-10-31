---
id: T-025
title: Operations: optional period on POST /operations
status: todo
epic: E-01
depends: [T-005, T-020]
blocked_by: []
spec: [API-10, API-21, MON-16, MON-01, MON-04, OP-16, UI-16, SCOPE-33]
acceptance: [AC-15, AC-16]
area: api
size: M
branch: null
pr: null
---

# T-025. Operations: optional period on POST /operations

## Goal

`POST /api/v1/operations` accepts an optional `period`; operations can be added to a reopened month or to the draft while another month is open.

## Context

- Spec: API-21, MON-16, UI-16. `CreateOperationRequestSchema` in `packages/types/src/schemas.ts` (add `period: PeriodSchema.optional()`); `OperationsService.create` in `apps/api/src/modules/operations/operations.service.ts` (`findCurrentMonth` is the default when `period` is absent: open > reopened > draft).
- With `period`: load that month (404 `MONTH_NOT_FOUND`), lock it, check `version` of that month, status closed -> 409 `MONTH_LOCKED`, then business rules. Cascade recalculation covers the target and later months.
- Depends on T-005 so that the two tasks do not edit `operations.service.ts` in parallel.

## Definition of Done

- [ ] `it('API-21 / MON-16: without period the operation goes to the open month even if a reopened month exists')` passes
- [ ] `it('API-21 / SCOPE-33: period of the reopened month adds the operation there and bumps that month version and later months results')` passes
- [ ] `it('API-21 / MON-01 / AC-16: period of the draft adds an operation to the draft')` passes
- [ ] `it('API-21 / MSG-06: period of a closed month answers 409 MONTH_LOCKED')`, `it('API-21: unknown period answers 404 MONTH_NOT_FOUND')` and `it('API-21 / ADR 0005: version of another month answers 409 VERSION_CONFLICT')` pass
- [ ] `it('API-21 / OP-16: sequence_no continues the target month sequence')` passes
- [ ] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Mobile forms passing `period` (T-011).
- PATCH/DELETE of operations (T-005).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
