---
id: T-007
title: Reporting: monthly dashboard endpoint
status: in_progress
epic: E-02
depends: [T-004, T-006]
blocked_by: []
spec: [API-12, UI-06, UI-07, UI-08, UI-09, FIN-11, FIN-12, HIST-12, OP-01, OP-02, OP-14, DATA-06]
acceptance: [AC-02, AC-19]
area: api
size: M
branch: task/T-007-dashboard-monthly-api
pr: null
---

# T-007. Reporting: monthly dashboard endpoint

## Goal

`GET /api/v1/dashboard/monthly?period=YYYY-MM` returns the month summary (income, allocated, free, net applied adjustments, uncovered total with per-type breakdown) and per-envelope figures (closing, allocation inflow, full expenses), plus warnings.

## Context

- Stub: `apps/api/src/modules/reporting/reporting.service.ts` and `reporting.controller.ts`.
- Source of the numbers: `EnvelopeMonthSnapshot` rows (DATA-06) written by the engine — do not recompute formulas in the service.
- Define response and query Zod schemas in `packages/types` (ADR 0003), regenerate the Orval client via `pnpm api:contract`.
- HIST-12: ordinary transfers do not increase "Replenished" nor "Spent"; adjustments are a separate indicator (UI-09); free funds do not depend on operations (FIN-12). Money is returned as decimal strings.

## Definition of Done

- [x] `it('FIN-11 / AC-02: income 100000, allocated 75000 gives free 25000')`
- [x] `it('FIN-12: expenses, transfers and adjustments do not change free funds')`
- [x] `it('HIST-12 / AC-19: a transfer changes two balances but not replenished and spent')`
- [x] `it('UI-09: adjustments are reported as a separate indicator')`
- [x] `it('OP-01: spent includes the uncovered part of an expense')`
- [x] Unknown period returns 404 `MONTH_NOT_FOUND`; invalid period 422
- [x] OpenAPI contract regenerated, `pnpm api:contract` clean
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Yearly analytics (T-008).
- UI (T-009).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

`GET /api/v1/dashboard/monthly?period=YYYY-MM` (period optional; default = working month open > reopened > draft, else latest).
Response `{ month: {id, period, status, version}, summary, envelopes[], warnings[] }`; all money as decimal strings
(adjustments signed). `summary`: income, allocated, free, replenished, spent, adjustmentsApplied, uncovered{total,expense,transfer,adjustment}.
Per envelope: opening, initial, closing, replenished (allocation only), spent (full requested expenses), expensesCovered,
adjustmentApplied, transfersIn/Out, uncovered{...}. Envelopes without a snapshot are listed with zeros. Values are read from
`EnvelopeMonthSnapshot`; nothing is recalculated. `warnings` re-derives `ARCHIVED_ENVELOPE_WITH_BALANCE` at read time (engine warnings are not persisted).

Deviations / follow-ups for the planner:
- `month` reuses `MonthSummarySchema.pick(id, period, status, version)`; the kopeck-integer fields of `MonthSummarySchema` are not repeated because the dashboard transports decimal strings (API-14).
- Creating a month (draft/auto-open) copies allocations but writes no snapshots, so the dashboard of a fresh month shows zeros (opening, replenished) until a mutation triggers the cascade. Proposed follow-up: recalculate on month creation.
- The open question on sourcing envelope balances from the dashboard (PR #12) is covered: the response carries per-envelope closing and flows.
- Added `SignedMoneyStringSchema` and `formatSignedMoneyMinor` to `@family-budget/types` (net adjustments can be negative).
- `ReportingService` keeps one public method per report; T-008 adds `yearlyAnalytics` next to `monthlyDashboard` (stub still returns empty shape).
