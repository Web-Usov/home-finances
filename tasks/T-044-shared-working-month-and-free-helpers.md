---
id: T-044
title: "API: shared working-month and free-funds helpers, dedup yearly uncovered schema"
status: todo
epic: E-00
depends: [T-043, T-008]
blocked_by: []
spec: [MON-16, FIN-11, REP-08]
acceptance: []
area: api
size: S
branch: null
pr: null
---

# T-044. API: shared working-month and free-funds helpers, dedup yearly uncovered schema

## Goal

One pure `pickWorkingMonth(months)` (open > reopened > draft, MON-16) and one `freeFundsMinor(income, allocated)` used by the reporting, envelopes, operations and months modules; `YearlyUncoveredValueSchema` is derived from `DashboardUncoveredSchema`.

## Context

- Duplicates: working-month selection in `reporting.service.ts`, `envelopes.service.ts`, `operations.service.ts`; `months.service.ts` computes `income - allocated` inline.
- `packages/types/src/schemas.ts`: `YearlyUncoveredValueSchema` repeats `DashboardUncoveredSchema` (REP-08/REP-09, UI-07); reuse it (same shape) without changing `openapi.json` output.
- Put the helpers in `apps/api/src/common/`; chained after T-043 because both edit envelopes.service.ts.

## Definition of Done

- [ ] Unit tests for both helpers (`it('MON-16: ...')`, `it('FIN-11: ...')`) incl. negative free funds
- [ ] No behavior change: existing tests pass; `pnpm api:contract` shows no drift
- [ ] `pnpm verify` is green
- [ ] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Behavior changes of the working-month rule.

## Handoff log

<!-- Append-only. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
