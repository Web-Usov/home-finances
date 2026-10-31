---
id: T-004
title: Operations: history list and create (expense, transfer, adjustment)
status: done
epic: E-01
depends: [T-003]
blocked_by: []
spec: [API-10, API-14, API-16, OP-01, OP-02, OP-03, OP-04, OP-05, OP-07, OP-09, OP-10, OP-14, OP-16, OP-17, HIST-05, HIST-09, HIST-10, HIST-11, DATA-09, DATA-11]
acceptance: [AC-05, AC-06, AC-07, AC-09, AC-10, AC-11]
area: api
size: M
branch: task/T-004-operations-list-create
pr: https://github.com/Web-Usov/home-finances/pull/10
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

- [x] Controller uses Zod schemas for body and query; no `unknown` DTOs
- [x] `it('OP-05 / AC-06: expense above balance is saved in full, covered 10000, uncovered 5000')`
- [x] `it('OP-05 / AC-05: expense within balance leaves 7000')`
- [x] `it('OP-07 / AC-07: transfer above available balance is rejected with TRANSFER_EXCEEDS_BALANCE')`
- [x] `it('OP-03 / AC-09: positive adjustment increases balance and leaves income and free funds unchanged')`
- [x] `it('OP-14 / AC-10: negative adjustment above balance applies only the balance')`
- [x] `it('OP-10 / AC-11: initial balance is not part of month indicators')`
- [x] `it('OP-17: new operation gets the next sequence_no')`
- [x] `it('HIST-10: create in a closed month returns MONTH_LOCKED')`
- [x] Integration tests for the HTTP layer incl. 422/409 paths and the history filters (`it('HIST-11: ...')`)
- [x] The WIP failing test and typecheck errors are resolved
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Update/delete of operations (T-005).
- UI (T-011, T-012).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

PR: see `pr` in the front matter. `POST /api/v1/operations` and `GET /api/v1/operations` work end to end.

- Request/response Zod schemas (with `version`, cross-field rules, list query, response shapes) live in `@family-budget/types`; the controller validates body and query with `ZodValidationPipe` and declares response schemas in Swagger (generated client is typed, no `void`).
- Month is picked, locked `FOR UPDATE` and version-checked inside the transaction; check order is existence -> `VERSION_CONFLICT` -> `MONTH_LOCKED` -> envelopes (`DATA-11`) -> `TRANSFER_EXCEEDS_BALANCE`. Engine runs with the same `tx`; the summary is re-read after the recalculation (version bump).
- `sequence_no` = max + 1 under the month row lock (concurrent creation test: one 201, one 409).
- PATCH/DELETE `/operations/:id` routes are removed for now (they returned a fake 200 `Not implemented`); T-005 adds them back with real behaviour. `OperationsService.update/remove` are gone for the same reason.

Deviations / follow-ups for the planner:
- Mutation response follows the T-003 convention `{ data, warnings }` with `data = { operation, result, summary }`; `summary` is the shared `MonthSummarySchema` (`id, period, status, incomeMinor, version, totalAllocatedMinor, freeFundsMinor`); response schemas reuse `mutationResponseSchema`/`ApiWarningSchema` from `@family-budget/types`. It does not carry the envelope balances / month indicators of `MonthSummary` (allocations response); API-16 "актуальная сводка" is ambiguous about which shape — consider one shared summary type. Envelope balances are in `result.sourceBalanceAfter/destinationBalanceAfter`.
- `type: initial_balance` is rejected by POST (422): OP-10 allows it only at envelope creation (the WIP accepted it). `history` still lists such operations.
- Operations are created only in the "current working month" (open > reopened > draft, else the latest month so a closed one reports `MONTH_LOCKED`); API-10 has no `period` in the request body, so `version` is that month's version.
- Unit test for `AC-05/AC-06/AC-07/AC-09/AC-10/AC-11` numbers are asserted at the integration level (real engine), unit tests cover service rules with a mocked engine.
- **Planner follow-up (needs a spec decision before T-011):** `POST /operations` has no `period`, so operations cannot target a reopened month while an open month exists (the working month is open > reopened > draft). Proposal: optional `period` in the request plus that month's `version`.
