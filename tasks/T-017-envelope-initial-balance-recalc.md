---
id: T-017
title: Envelope created with an initial balance must show that balance (recalculate month)
status: todo
epic: E-00
depends: []
blocked_by: []
spec: [ENV-03, OP-10, FIN-14, CALC-04]
acceptance: [AC-01, AC-11]
area: api
size: S
branch: null
pr: null
---

# T-017. Envelope created with an initial balance must show that balance (recalculate month)

## Goal

After `POST /api/v1/envelopes` with `initialBalance`, the envelope's balance seen by clients (`GET /api/v1/envelopes`, month summary) equals the initial balance instead of 0.

## Context

Observed in the PR #1 e2e smoke run: an envelope created through the API with an initial balance came back with balance 0 when listed afterwards. The `POST` response itself echoes `balanceMinor: initialBalanceMinor` (`envelopes.service.ts:124`), so the problem is in the persisted derived data.

Hypothesis (not verified end to end):

- `EnvelopesService.create` (`apps/api/src/modules/envelopes/envelopes.service.ts:99-122`) inserts the `initial_balance` operation but never calls `CalculationEngineService.recalculateMonthAtomically(monthId, tx)`; the service does not even inject the engine. Per CALC-04 the initial balance is applied by the recalculation, which also writes `OperationResult` and `EnvelopeMonthSnapshot`.
- `list()` (`envelopes.service.ts:47-62`, `findLatestClosingBalances` at `:242-266`) reads balances only from `EnvelopeMonthSnapshot.closing`, so with no recalculation there is no snapshot and the balance is 0.
- Secondary checks: initial balance with no month throws `MONTH_LOCKED` (`:83-88`) — verify this matches ENV-03/OP-10 and the intended error code; the month must be open/reopened/draft per `findCurrentMonth` (`:205`).

Rules: ENV-03 (optional initial balance as a separate adjustment), OP-10 (non-negative, only at envelope creation, not part of monthly indicators), FIN-14 (applied in the creation month before user operations), CALC-04. Pattern to follow: `AllocationsService` (mutation + `engine.recalculateMonthAtomically` in one transaction). Do not edit `docs/spec/**`; if the rules turn out ambiguous, set the task `blocked` with a Q-proposal.

## Definition of Done

- [ ] Integration test `ENV-03 / OP-10 / FIN-14: envelope created with initial balance shows it in GET /envelopes` (`*.int-spec.ts`, real DB) fails before the fix and passes after
- [ ] Unit test `OP-10: initial balance recalculates the month in the same transaction` (engine called with the transaction client)
- [ ] Initial balance is not counted in the monthly "adjustments" indicator (FIN-14) — asserted in a test
- [ ] E2E helper `api.createEnvelope(name, initialBalance)` in `e2e/` is covered by a spec asserting the balance via API (`pnpm e2e:smoke` or `e2e:full`)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Operations update/delete and other operation types (T-004, T-005).
- Changing spec rules.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
