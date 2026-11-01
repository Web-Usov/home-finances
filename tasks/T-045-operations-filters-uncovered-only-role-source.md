---
id: T-045
title: "Operations: uncoveredOnly and role=source filters for analytics drill-down"
status: done
epic: E-02
depends: [T-008, T-025]
blocked_by: []
spec: [HIST-15, HIST-11, REP-10]
acceptance: [AC-20]
area: api
size: M
branch: task/T-045-operations-filters-uncovered-only-role-source
pr: https://github.com/Web-Usov/home-finances/pull/49
---

# T-045. Operations: uncoveredOnly and role=source filters for analytics drill-down

## Goal

Analytics drill-down keys (REP-10) open exactly the history rows behind a report number: `GET /operations` supports `role=source` and `uncoveredOnly=true` and the yearly report emits them in `drillDown`.

## Context

- `OperationListQuerySchema` / `AnalyticsDrillDownSchema` in `packages/types/src/schemas.ts`; `operations.service.ts` list; `reporting.service.ts` drill-down keys (T-008).
- Spec: HIST-15 (new). Today `type=adjustment` also returns positive adjustments and `envelopeId` matches the destination of a transfer, so the list is a superset of the number.
- The analytics screen (T-013) is already done and links with the old keys; switching its drill-down links to the new filters is part of this task (small mobile change in the analytics screen, with its component test).

## Definition of Done

- [x] `it('HIST-15 / REP-10: uncoveredOnly returns only operations with uncovered > 0')` int test
- [x] `it('HIST-15 / REP-10: role=source ignores transfers into the envelope')` int test
- [x] `it('REP-10: drillDown of every non-zero uncovered value returns exactly the rows summing to it')` reporting int test
- [x] `pnpm api:generate` run, `pnpm api:contract` green
- [x] `pnpm verify` is green
- [x] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Other mobile changes.

## Handoff log

<!-- Append-only. -->

## Result

- `GET /operations` accepts `uncoveredOnly=true|false` and `role=source` (`OperationListQuerySchema`, Swagger, regenerated client); services filter on `result.uncoveredMinor > 0` and the source envelope only.
- `AnalyticsDrillDownSchema` keeps the keys `period/envelopeId/type` (narrowed with `pick`, so the API response shape is unchanged); `buildHistoryLink` adds `uncoveredOnly=true` and `role=source`, the History tab reads them, passes them to the list query and shows the clearable chip «Только непокрытые». Clearing the chip drops both params.
- Tests: `operations.list-filters.int-spec.ts`, a drill-down sum test in `reporting.yearly-analytics.int-spec.ts`, `HistoryView`/`drillDown`/`YearlyAnalyticsView` component tests, e2e `analytics` (smoke) and `journeys/year-analytics` assert the drill-down row count.
- Deviation: the drill-down keys in the yearly response were not extended (the client adds the filters), so the API contract of `drillDown` is unchanged.
