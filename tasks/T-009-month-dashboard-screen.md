---
id: T-009
title: Mobile: month dashboard screen, period switcher and month actions
status: in_progress
epic: E-03
depends: [T-006, T-007]
blocked_by: []
spec: [UI-01, UI-02, UI-06, UI-07, UI-08, UI-09, UI-10, MON-12, MSG-06, SCOPE-23, SCOPE-26, SCOPE-29, NFR-20]
acceptance: [AC-01, AC-14, AC-15, AC-16]
area: mobile
size: M
branch: task/T-009-month-dashboard-screen
pr: null
---

# T-009. Mobile: month dashboard screen, period switcher and month actions

## Goal

The "Month" tab shows the real dashboard from the API: period switcher, status, summary indicators, envelope list, and actions create first/next month, close, reopen (with the recalculation-range warning); quick-action buttons disabled in a closed month.

## Context

- Placeholder: `apps/mobile/app/(tabs)/month.tsx`. Stores: `apps/mobile/src/stores/monthStore.ts`. Generated hooks: `apps/mobile/src/api/{months,reporting}` (regenerate, never hand-edit; ADR 0012).
- Reference for API-wired screen and forms: `apps/mobile/app/(tabs)/envelopes.tsx` and `src/components/envelopes/*`.
- Styling: NativeWind `className` only. Money formatting via `formatMoneyMinor`/ru-RU helpers. Messages verbatim from MSG-06.
- Empty state: no months yet -> create first month with income (SCOPE-23, MON-05).
- Layout from 360 px without horizontal scroll (NFR-20).

## Definition of Done

- [ ] Mobile component tests: `it('UI-07: shows income, allocated and free from the dashboard response')`, `it('MSG-06 / AC-14: quick actions are disabled in a closed month')`, `it('AC-15: reopening asks for confirmation first ...')` (the recalculation range is reported from the reopen response, see Out of scope)
- [ ] Playwright spec `e2e/month-dashboard.e2e.ts` (named e2e) covering first-month creation (`AC-01`), close and reopen, using the test DB
- [ ] Screenshots of empty state, open month and closed month attached as Playwright artifacts
- [ ] No `StyleSheet.create`, no hardcoded API URL
- [ ] `pnpm verify` is green
- [ ] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Allocation editor (T-010).
- Operation forms (T-011).
- Envelope management (already exists).
- MON-12 / AC-15 "show the recalculation range BEFORE reopening": deferred to T-024. The preview endpoint is pending (spec PR #12), so the reopen confirmation shows a generic warning and the range from the reopen response is shown afterwards. `ReopenConfirm` already accepts an optional `recalcRange`; T-024 only has to fetch the preview and pass it in. The former DoD test `MON-12 / AC-15: reopen shows the recalculation range before confirming` moves to T-024 (`ReopenConfirm.test.tsx` already covers the component with a range supplied).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
