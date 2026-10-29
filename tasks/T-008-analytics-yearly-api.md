---
id: T-008
title: Reporting: yearly analytics endpoint (three reports)
status: todo
epic: E-02
depends: [T-004]
blocked_by: []
spec: [API-13, REP-01, REP-02, REP-03, REP-04, REP-05, REP-06, REP-08, REP-09, REP-10, REP-11]
acceptance: [AC-20]
area: api
size: M
branch: null
pr: null
---

# T-008. Reporting: yearly analytics endpoint (three reports)

## Goal

`GET /api/v1/analytics/yearly?year=YYYY` returns the three mandatory reports: income/allocation/free by month with totals, envelope closing balances by month (active and archived flagged), and uncovered amounts by month split by expenses/transfers/negative adjustments with drill-down keys for the history.

## Context

- Stub: `reporting.service.ts` `yearly`. Read from `EnvelopeMonthSnapshot` and `BudgetMonth`; archived envelopes stay in the report (ENV-12).
- Response/query schemas go to `packages/types`; regenerate Orval via `pnpm api:contract`.
- REP-10: each value must carry what the UI needs to open history (period, envelope, type).
- Missing months of the year return null/zero entries, not errors.

## Definition of Done

- [ ] `it('REP-01 / AC-20: response contains all three reports with 12 months')`
- [ ] `it('REP-04: free funds are historical and not added to envelope balances')`
- [ ] `it('REP-08 / REP-09: uncovered amounts split by expense, transfer and negative adjustment')`
- [ ] `it('REP-06: archived envelopes are included and flagged')`
- [ ] `it('REP-11: uncovered amounts do not appear in later months')`
- [ ] Invalid year returns 422
- [ ] OpenAPI contract regenerated, `pnpm api:contract` clean
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Charts/UI (T-013).
- Exports.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
