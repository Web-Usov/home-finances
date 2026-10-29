---
id: T-004
title: Operations: history list and create (expense, transfer, adjustment)
status: todo
epic: E-01
depends: [T-003]
blocked_by: []
spec: [API-10, API-14, API-16, OP-01, OP-02, OP-03, OP-04, OP-05, OP-07, OP-09, OP-10, OP-14, OP-16, OP-17, HIST-05, HIST-09, HIST-10, HIST-11, DATA-09, DATA-11]
acceptance: [AC-05, AC-06, AC-07, AC-09, AC-10, AC-11]
area: api
size: M
branch: null
pr: null
---

# T-004. Operations: history list and create (expense, transfer, adjustment)

## Goal

`GET /api/v1/operations` (filters: period, envelopeId, type) and `POST /api/v1/operations` work end to end with validation, month-status checks, sequence_no assignment, cascade recalculation and warnings.

## Context

- Branch `wip/operations-income` has a large partial implementation: `operations.service.ts` (list/create done; update/remove throw "Not implemented"), `operations.dto.ts`, `operations.service.spec.ts` (~630 lines), `allocations.integration.spec.ts`. Inspect with `git show --stat wip/operations-income` and `git diff master...wip/operations-income -- apps`. Bring it onto this task branch and finish; its comments contain "SPECIFICATION.md line NNN" — convert to rule IDs.
- The WIP defines local request schemas extending the shared ones with `version`. Per ADR 0003 schemas belong in `@family-budget/types`: move them there (then regenerate the Orval client, `pnpm api:contract`).
- `OperationsController` currently takes `unknown` DTOs: use `ZodValidationPipe` and a Zod query schema for filters.
- Engine: `CalculationEngineService.recalculateMonthAtomically(monthId, tx)` in the same transaction as the write.
- Rules: OP-05/OP-09/OP-14 formulas live in the engine; service enforces OP-07 (transfer cannot exceed available balance on creation, error `TRANSFER_EXCEEDS_BALANCE`).

## Definition of Done

- [ ] Controller uses Zod schemas for body and query; no `unknown` DTOs
- [ ] `it('OP-05 / AC-06: expense above balance is saved in full, covered 10000, uncovered 5000')`
- [ ] `it('OP-05 / AC-05: expense within balance leaves 7000')`
- [ ] `it('OP-07 / AC-07: transfer above available balance is rejected with TRANSFER_EXCEEDS_BALANCE')`
- [ ] `it('OP-03 / AC-09: positive adjustment increases balance and leaves income and free funds unchanged')`
- [ ] `it('OP-14 / AC-10: negative adjustment above balance applies only the balance')`
- [ ] `it('OP-10 / AC-11: initial balance is not part of month indicators')`
- [ ] `it('OP-17: new operation gets the next sequence_no')`
- [ ] `it('HIST-10: create in a closed month returns MONTH_LOCKED')`
- [ ] Integration tests for the HTTP layer incl. 422/409 paths and the history filters (`it('HIST-11: ...')`)
- [ ] The WIP failing test and typecheck errors are resolved
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Update/delete of operations (T-005).
- UI (T-011, T-012).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
