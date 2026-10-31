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

- [ ] Mobile tests: `it('REP-02: grouped chart data has 12 months')`, `it('REP-06: archived envelopes can be toggled in the balance table')`, `it('REP-10: clicking an uncovered value navigates to history with filters')`
- [ ] Playwright spec `e2e/analytics.e2e.ts` covering `AC-20`
- [ ] Screenshots of all three reports attached as artifacts
- [ ] `pnpm verify` is green
- [ ] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Exports.
- New report types.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
