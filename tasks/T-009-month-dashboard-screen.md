---
id: T-009
title: Mobile: month dashboard screen, period switcher and month actions
status: done
epic: E-03
depends: [T-006, T-007]
blocked_by: []
spec: [UI-01, UI-02, UI-06, UI-07, UI-08, UI-09, UI-10, MON-12, MSG-06, SCOPE-23, SCOPE-26, SCOPE-29, NFR-20]
acceptance: [AC-01, AC-14, AC-15, AC-16]
area: mobile
size: M
branch: task/T-009-month-dashboard-screen
pr: https://github.com/Web-Usov/home-finances/pull/23
---

# T-009. Mobile: month dashboard screen, period switcher and month actions

## Goal

The "Month" tab shows the real dashboard from the API: period switcher, status, summary indicators, envelope list, and actions create first/next month, close, reopen (with the recalculation-range warning); quick-action buttons disabled in a closed month.

## Context

- Placeholder: `apps/mobile/app/(tabs)/month.tsx`. Stores: `apps/mobile/src/stores/monthStore.ts`. Generated hooks: `apps/mobile/src/api/{months,reporting}` (regenerate, never hand-edit; ADR 0012).
- Reference for API-wired screen and forms: `apps/mobile/app/(tabs)/envelopes.tsx` and `src/components/envelopes/*`.
- Styling: NativeWind `className` only. Money formatting via `formatMoneyMinor`/ru-RU helpers. Messages verbatim from MSG-06.
- Reopen warning (MON-12): call `GET /api/v1/months/:period/reopen-preview` (API-20, T-024) before confirming; the range is never computed in the client.
- Empty state: no months yet -> create first month with income (SCOPE-23, MON-05).
- Layout from 360 px without horizontal scroll (NFR-20).

## Definition of Done

- [x] Mobile component tests: `it('UI-07: shows income, allocated and free from the dashboard response')`, `it('MSG-06 / AC-14: quick actions are disabled in a closed month')`, `it('AC-15: reopening asks for confirmation first ...')` (the recalculation range is reported from the reopen response, see Out of scope)
- [x] Playwright spec `e2e/month-dashboard.e2e.ts` (named e2e) covering first-month creation (`AC-01`), close and reopen, using the test DB
- [x] Screenshots of empty state, open month and closed month attached as Playwright artifacts
- [x] No `StyleSheet.create`, no hardcoded API URL
- [x] `pnpm verify` is green
- [x] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Allocation editor (T-010).
- Operation forms (T-011).
- Envelope management (already exists).
- MON-12 / AC-15 "show the recalculation range BEFORE reopening": deferred to T-024. The preview endpoint is pending (spec PR #12), so the reopen confirmation shows a generic warning and the range from the reopen response is shown afterwards. `ReopenConfirm` already accepts an optional `recalcRange`; T-024 only has to fetch the preview and pass it in. The former DoD test `MON-12 / AC-15: reopen shows the recalculation range before confirming` moves to T-024 (`ReopenConfirm.test.tsx` already covers the component with a range supplied).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Implemented the "Месяц" tab on the real API (`GET /dashboard/monthly`, `GET/POST /months`, `PATCH /months/:period`, `POST close|reopen`).

- Screen `app/(tabs)/month.tsx` + `src/components/month/*`: `MonthDashboard`, `PeriodSwitcher` (month and year steps over existing months, month-only, AC-21), `MonthStatusBadge`, `MonthActions` (create next / close / reopen with `ReopenConfirm`), `SummaryCard` (UI-07, UI-09), `EnvelopeRow` (UI-08), `QuickActions` (UI-10, disabled when closed with the MSG-06 text), `IncomeForm`, `FirstMonthForm` (empty state, SCOPE-23). Helpers in `src/lib` (`money.ts` ru-RU display of API decimal strings without float math, `period.ts`, `apiErrors.ts`: `MONTH_LOCKED` -> verbatim MSG-06, `VERSION_CONFLICT` -> API message plus refetch).
- The first dashboard load without a chosen period lets the API pick the working month and pins that period in `monthStore`, so the view stays on the month after it is closed.
- Tests: jest component/unit tests (`MonthDashboard`, `FirstMonthForm`, `ReopenConfirm`, `money`, `period`); Playwright `e2e/month-dashboard.e2e.ts` (two `@smoke` flows with screenshots attached to the report, one untagged 360 px layout check), `e2e/fixtures/api.ts` gained `closeMonth`.

Deviations / notes:
- MON-12 / AC-15: the range is NOT shown before reopening; the preview endpoint is T-024 (spec PR #12). The confirmation shows a generic warning, the range from the reopen response is shown afterwards. `ReopenConfirm` takes an optional `recalcRange` for T-024 to plug in. The matching DoD test moved to Out of scope.
- The OpenAPI document has no body for `POST /months` and no response schemas for `GET /months`, so the generated `useMonthsControllerCreateV1` sends no body and `useMonthsControllerListV1` is typed `void`. The list hook is re-typed through its generic (as the Envelopes screen does); creation uses `useMutation` + the Orval mutator (`useCreateMonth`). Follow-up for the API owner: add `@ApiBody` for `CreateMonthRequestSchema` and response schemas for the months list/create, then regenerate and switch to the generated hook. Likewise `period` of the dashboard query is typed `unknown`.
- UI-10 quick-action buttons are rendered and enabled in non-closed months but have no handler yet (`onAction` prop); the operation forms are T-011.
- Own Russian texts where the spec has none: hints for draft/closed states, notices after create/close/reopen, the first-month form copy.
- Review round: "Создать следующий" is enabled only on the latest month; notices use ru-RU month case forms (`formatPeriodGenitive` / `formatPeriodLower`); the Envelopes screen uses the shared `formatRubles`; slow mobile suites set `jest.setTimeout(20000)` per suite (first render exceeds the 5 s default on a loaded machine).
