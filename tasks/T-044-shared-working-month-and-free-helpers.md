---
id: T-044
title: "API: shared working-month and free-funds helpers, dedup yearly uncovered schema"
status: in_progress
epic: E-00
depends: [T-043, T-008]
blocked_by: []
spec: [MON-16, FIN-11, REP-08]
acceptance: []
area: api
size: S
branch: task/T-044-shared-working-month-and-free-helpers
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

- [x] Unit tests for both helpers (`it('MON-16: ...')`, `it('FIN-11: ...')`) incl. negative free funds
- [x] No behavior change: existing tests pass; `pnpm api:contract` shows no drift
- [x] `pnpm verify` is green
- [x] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Behavior changes of the working-month rule.

## Handoff log

<!-- Append-only. -->

## Result

Added `pickWorkingMonth` (`common/working-month.ts`) and `freeFundsMinor` (`common/free-funds.ts`) with unit tests.
- `pickWorkingMonth`: used by `reporting.service.findMonthOrThrow` and `month-lock.findWorkingMonth` (the only two own copies; `envelopes` and `operations` already delegate to `lockWorkingMonth`, so they pick it up through `month-lock`).
- `freeFundsMinor`: used by reporting (dashboard, yearly income rows and totals), `months.service.toSummary`, `operations.service` summary, `common/month-summary.ts`. Allocations validate through `validateAllocations` (types), no inline `income - allocated`.
- `YearlyUncoveredValueSchema` is now an alias of `DashboardUncoveredSchema`; `openapi.json` and the generated client are unchanged.
