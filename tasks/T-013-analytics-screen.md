---
id: T-013
title: Mobile: yearly analytics screen
status: in_progress
epic: E-05
depends: [T-008, T-012]
blocked_by: []
spec: [UI-04, REP-01, REP-02, REP-03, REP-05, REP-06, REP-07, REP-08, REP-09, REP-10, NFR-22]
acceptance: [AC-20]
area: mobile
size: M
branch: task/T-013-analytics-screen
pr: null
---

# T-013. Mobile: yearly analytics screen

## Goal

The "Analytics" tab shows the year selector and three reports with tables and charts (envelope picker on the line chart), and drill-down from a value into the month or history with matching filters.

## Context

- Placeholder: `apps/mobile/app/(tabs)/analytics.tsx`. API: `GET /analytics/yearly` (T-008), generated hook in `apps/mobile/src/api/reporting`.
- Charts must work in Expo web (React Native Web); pick a lightweight library compatible with Expo SDK in use and record the choice in the Result section (propose an ADR to the planner if it is a significant dependency).
- Drill-down uses the history route params introduced in T-012.
- Tables must be keyboard/screen-reader friendly (NFR-22).

## Definition of Done

- [x] Mobile tests: `it('REP-02: grouped chart data has 12 months')`, `it('REP-06: archived envelopes can be toggled in the balance table')`, `it('REP-10: clicking an uncovered value navigates to history with filters')`
- [x] Playwright spec `e2e/analytics.e2e.ts` covering `AC-20`
- [x] Screenshots of all three reports attached as artifacts
- [x] `pnpm verify` is green
- [x] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Exports.
- New report types.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

- Analytics tab: year switcher (defaults to the current year) and three reports in `apps/mobile/src/components/analytics/*`: income / allocated / free by month with totals (negative free highlighted), envelope balances (horizontal scroll inside the table only, archived flagged and toggleable, missing months "—"), uncovered operations by month and type with totals.
- Drill-down: tapping a non-zero uncovered value calls `router.push(buildHistoryLink(key))`; `src/lib/drillDown.ts` is the single helper (params `period`, `envelopeId`, `type`) for T-045 to extend with `uncoveredOnly` / `role=source`.
- Charts: no chart library. REP-02 is a plain-View grouped bar chart (decorative, hidden from assistive tech; tables carry the exact values). Deviation: the REP-07 line chart with an envelope picker is not implemented (charts optional per orchestrator); propose a follow-up task. Per-envelope uncovered breakdown (`envelopes[].drillDown`) is not shown either; the helper already supports `envelopeId`.
- Tests: `YearlyAnalyticsView.test.tsx`, `drillDown.test.ts`, Playwright `e2e/analytics.e2e.ts` (@smoke, AC-20, 360 px no page scroll, drill-down to History); screenshots are attached to the Playwright report.
