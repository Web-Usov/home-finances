---
id: T-037
title: Mobile: show the recalculation range before reopening (reopen preview)
status: done
epic: E-03
depends: [T-009, T-024]
blocked_by: []
spec: [MON-12, API-20, SCOPE-32]
acceptance: [AC-15]
area: mobile
size: S
branch: task/T-037-mobile-reopen-preview
pr: https://github.com/Web-Usov/home-finances/pull/37
---

# T-037. Mobile: show the recalculation range before reopening (reopen preview)

## Goal

The reopen confirmation on the month screen shows the range of months that will be recalculated before the user confirms (MON-12), using `GET /api/v1/months/:period/reopen-preview`.

## Context

- `apps/mobile/src/components/month/ReopenConfirm.tsx` (T-009) already accepts an optional `recalcRange` prop; `MonthActions.tsx` renders it without a range today (generic warning).
- API: preview endpoint from T-024 (API-20); use the generated hook in `apps/mobile/src/api` after `pnpm api:generate` on master. The range is never computed in the client.
- While the preview loads show a pending state; on 409/404 show the error message and no confirm button.

## Definition of Done

- [x] `it('MON-12 / AC-15: reopen shows the recalculation range from the preview before confirming')` (mobile component test) passes
- [x] `it('MON-12: preview error ...')` passes (the confirm button is disabled, not hidden, and the API message is shown: ReopenConfirm.test.tsx, MonthDashboard.test.tsx)
- [x] `e2e/month-dashboard.e2e.ts` (or the existing month e2e) asserts the range text before confirming reopen; `pnpm e2e:smoke` is green
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- The preview endpoint itself (T-024).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

`ReopenConfirm` takes `loading` / `error` props next to `recalcRange`; `MonthActions` fetches `GET /months/:period/reopen-preview` (generated hook, enabled only while the confirmation is open, no retry, `staleTime`/`gcTime` 0 so every opening is fresh). While loading the confirm button is disabled; a 404/409 shows the API message and keeps confirm disabled (disabled rather than hidden, per the orchestrator's brief). The preview is advisory: the after-reopen notice still uses the reopen response range. E2E AC-15 / MON-12 asserts the range text before confirming (screenshot `5-reopen-confirmation` in the Playwright report).
