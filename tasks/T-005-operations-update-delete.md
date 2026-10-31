---
id: T-005
title: Operations: update and delete with stable sequence and recalculation
status: done
epic: E-01
depends: [T-004]
blocked_by: []
spec: [API-11, FIN-05, OP-16, OP-17, OP-18, HIST-07, HIST-08, HIST-09, HIST-10, DATA-10, CALC-05, CALC-08, CALC-09, CALC-10]
acceptance: [AC-08, AC-12, AC-13, AC-14]
area: api
size: M
branch: task/T-005-operations-update-delete
pr: https://github.com/Web-Usov/home-finances/pull/13
---

# T-005. Operations: update and delete with stable sequence and recalculation

## Goal

`PATCH` and `DELETE /api/v1/operations/:id` edit/remove an operation in a draft/open/reopened month, keep `sequence_no` stable (gaps allowed after delete), and cascade recalculation through later months in one transaction.

## Context

- `OperationsService.update` / `remove` are `throw new Error('Not implemented')` in the WIP (branch `wip/operations-income`); depends on create from T-004.
- Editing a transfer re-runs the available-balance check (HIST-09); retroactive deficits after cascade stay as uncovered (OP-08, CALC-09) and must not be rejected.
- Engine rebuilds derived rows; verify that deleting leaves a numbering gap (OP-18) and edit does not change `sequence_no` (OP-17).
- Use `ZodValidationPipe` for the body; delete takes `version` (ADR 0005) — decide query vs body and document it in the Result section.

## Definition of Done

- [x] `it('OP-17 / AC-12: editing the first operation keeps its sequence_no and later results are recalculated in the old order')`
- [x] `it('OP-18 / AC-13: delete leaves a sequence gap and updates this and later months')`
- [x] `it('HIST-09: edited transfer above available balance is rejected')`
- [x] `it('OP-08 / AC-08: retroactive deficit keeps the full transfer, destination gets the full amount, source deficit is uncovered')`
- [x] `it('HIST-10 / AC-14: update and delete in a closed month return MONTH_LOCKED')`
- [x] `it('DATA-12: stale version returns VERSION_CONFLICT')`
- [x] Mutations return summary + warnings (API-16); the whole change is atomic (a failing recalculation rolls back the edit — test it)
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- UI.
- Manual reordering (not in MVP, OP-18).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

PR: see `pr` in the front matter.

**Changes**
- `PATCH /api/v1/operations/:id` (body: `amount`, `sourceEnvelopeId`, `destinationEnvelopeId`, `comment`, `version`) and
  `DELETE /api/v1/operations/:id?version=N`. Both run in one transaction: operation lookup → `FOR UPDATE` on the
  operation's own month row → `version` check (VERSION_CONFLICT) → status check (MONTH_LOCKED) → rules → write →
  `recalculateMonthAtomically` (bumps `version` of the month and later months).
- `sequence_no` is never written on edit; delete leaves a gap and new operations still take `max + 1` (OP-17/OP-18).
- Types: `DeleteOperationQuerySchema`, `DeleteOperationResponseSchema` (built from `mutationResponseSchema` and
  `MonthSummarySchema`), new `ApiErrorCode` `OPERATION_NOT_FOUND`. Swagger response schemas declared; client regenerated.

**Decisions / deviations**
- `version` for DELETE goes in the **query** (DELETE bodies are poorly supported by proxies and the generated client).
- Transfer edit check (HIST-09/OP-07): after the replay inside the transaction, if the edited transfer itself is uncovered
  (amount or source changed) the request fails with TRANSFER_EXCEEDS_BALANCE offering `sourceBalanceBefore` (the balance the
  transfer meets at its own `sequence_no` position) and the transaction rolls back. Consequence: later operations that lose cover
  because of the edit become uncovered (OP-08 style) instead of rejecting it. A comment/destination-only edit of an already
  uncovered transfer is allowed.
- Envelope rules (DATA-11): only envelopes that the edit changes are re-validated (archived at or before the month → 409
  INVALID_STATUS_TRANSITION, as in create); an unchanged archived envelope does not block an edit.
- The initial balance operation (OP-10) cannot be edited/deleted via this API: 422 VALIDATION_ERROR.
- Malformed `:id` → 422 VALIDATION_ERROR (Zod pipe), not a DB error. Empty `comment` clears it.
- Operation type cannot be changed by PATCH (schema has no `type`); `destinationEnvelopeId` on a non-transfer → 422.

**Planner follow-ups**: spec has no rule/code for a missing operation (`OPERATION_NOT_FOUND`, added to `ApiErrorCode`), for editing
the initial balance, nor for which "available balance" HIST-09 means on edit (position-based chosen). `docs/spec` API-11 path
lacks `/v1` and the `version` parameter of DELETE.

