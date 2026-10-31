---
id: T-005
title: Operations: update and delete with stable sequence and recalculation
status: in_progress
epic: E-01
depends: [T-004]
blocked_by: []
spec: [API-11, FIN-05, OP-16, OP-17, OP-18, HIST-07, HIST-08, HIST-09, HIST-10, DATA-10, CALC-05, CALC-08, CALC-09, CALC-10]
acceptance: [AC-08, AC-12, AC-13, AC-14]
area: api
size: M
branch: task/T-005-operations-update-delete
pr: null
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

- [ ] `it('OP-17 / AC-12: editing the first operation keeps its sequence_no and later results are recalculated in the old order')`
- [ ] `it('OP-18 / AC-13: delete leaves a sequence gap and updates this and later months')`
- [ ] `it('HIST-09: edited transfer above available balance is rejected')`
- [ ] `it('OP-08 / AC-08: retroactive deficit keeps the full transfer, destination gets the full amount, source deficit is uncovered')`
- [ ] `it('HIST-10 / AC-14: update and delete in a closed month return MONTH_LOCKED')`
- [ ] `it('DATA-12: stale version returns VERSION_CONFLICT')`
- [ ] Mutations return summary + warnings (API-16); the whole change is atomic (a failing recalculation rolls back the edit — test it)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- UI.
- Manual reordering (not in MVP, OP-18).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
