---
id: T-008
title: Reporting: yearly analytics endpoint (three reports)
status: done
epic: E-02
depends: [T-004]
blocked_by: []
spec: [API-13, REP-01, REP-02, REP-03, REP-04, REP-05, REP-06, REP-08, REP-09, REP-10, REP-11]
acceptance: [AC-20]
area: api
size: M
branch: task/T-008-analytics-yearly-api
pr: https://github.com/Web-Usov/home-finances/pull/17
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

- [x] `it('REP-01 / AC-20: response contains all three reports with 12 months')`
- [x] `it('REP-04: free funds are historical and not added to envelope balances')`
- [x] `it('REP-08 / REP-09: uncovered amounts split by expense, transfer and negative adjustment')`
- [x] `it('REP-06: archived envelopes are included and flagged')`
- [x] `it('REP-11: uncovered amounts do not appear in later months')`
- [x] Invalid year returns 422
- [x] OpenAPI contract regenerated, `pnpm api:contract` clean
- [x] `pnpm verify` is green
- [x] Review finding (PR #14): `DashboardSummarySchema.free` is signed (`SignedMoneyStringSchema`) + test `FIN-11: free is signed...`
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Charts/UI (T-013).
- Exports.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

`GET /api/v1/analytics/yearly?year=YYYY` (query validated, 422 on missing/invalid year). Response (`YearlyAnalyticsResponseSchema`
in `@family-budget/types`), all values read from `BudgetMonth`, `Allocation` and `EnvelopeMonthSnapshot`, decimal strings:

- `incomeReport`: `months[12]` `{period, status|null, income|null, allocated|null, free|null}` (free signed) + `totals` (REP-02..04).
- `envelopeBalances`: `periods[12]` + `envelopes[]` `{envelopeId, name, status, displayOrder, createdPeriod, archivedPeriod, months[12] {period, closing|null}}`;
  archived envelopes stay in with `status: 'archived'` (REP-05, REP-06, ENV-12). `closing` is null where the month does not exist
  or the envelope is not listed in it.
- `uncoveredOperations`: `months[12]` `{period, exists, total, expense, transfer, adjustment, drillDown, drillDownByType, envelopes[]}` + `totals`;
  per-envelope rows carry `drillDown {period, envelopeId}`. Drill-down keys equal the `GET /operations` filters (REP-10, HIST-11).

Also: review finding from PR #14 fixed - `DashboardSummarySchema.free` is now `SignedMoneyStringSchema` (+ test).

Deviations / follow-ups:
- Missing months give null values (income report, balances) or zero amounts with `exists: false` (uncovered).
- The duplicated "working month" selection (open > reopened > draft > latest) in reporting/envelopes/operations was NOT extracted:
  the three copies take different db clients and the envelopes/operations unit tests mock their exact Prisma calls, so a shared helper
  is not a small safe change here. Proposed follow-up task: shared pure `pickWorkingMonth(months)` in `common/`.
- Pre-existing defect (separate task): a new month has no snapshots until a mutation recalculates; yearly balances for such a month are 0 until then.
