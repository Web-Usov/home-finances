---
id: T-007
title: Reporting: monthly dashboard endpoint
status: todo
epic: E-02
depends: [T-004, T-006]
blocked_by: []
spec: [API-12, UI-06, UI-07, UI-08, UI-09, FIN-11, FIN-12, HIST-12, OP-01, OP-02, OP-14, DATA-06]
acceptance: [AC-02, AC-19]
area: api
size: M
branch: null
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

- [ ] `it('FIN-11 / AC-02: income 100000, allocated 75000 gives free 25000')`
- [ ] `it('FIN-12: expenses, transfers and adjustments do not change free funds')`
- [ ] `it('HIST-12 / AC-19: a transfer changes two balances but not replenished and spent')`
- [ ] `it('UI-09: adjustments are reported as a separate indicator')`
- [ ] `it('OP-01: spent includes the uncovered part of an expense')`
- [ ] Unknown period returns 404 `MONTH_NOT_FOUND`; invalid period 422
- [ ] OpenAPI contract regenerated, `pnpm api:contract` clean
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Yearly analytics (T-008).
- UI (T-009).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
