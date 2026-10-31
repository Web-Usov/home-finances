---
id: T-036
title: Mobile: show the recalculation range before reopening (reopen preview)
status: todo
epic: E-03
depends: [T-009, T-024]
blocked_by: []
spec: [MON-12, API-20, SCOPE-32]
acceptance: [AC-15]
area: mobile
size: S
branch: null
pr: null
---

# T-036. Mobile: show the recalculation range before reopening (reopen preview)

## Goal

The reopen confirmation on the month screen shows the range of months that will be recalculated before the user confirms (MON-12), using `GET /api/v1/months/:period/reopen-preview`.

## Context

- `apps/mobile/src/components/month/ReopenConfirm.tsx` (T-009) already accepts an optional `recalcRange` prop; `MonthActions.tsx` renders it without a range today (generic warning).
- API: preview endpoint from T-024 (API-20); use the generated hook in `apps/mobile/src/api` after `pnpm api:generate` on master. The range is never computed in the client.
- While the preview loads show a pending state; on 409/404 show the error message and no confirm button.

## Definition of Done

- [ ] `it('MON-12 / AC-15: reopen shows the recalculation range from the preview before confirming')` (mobile component test) passes
- [ ] `it('MON-12: preview error hides the confirm button and shows the message')` passes
- [ ] `e2e/month-dashboard.e2e.ts` (or the existing month e2e) asserts the range text before confirming reopen; `pnpm e2e:smoke` is green
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- The preview endpoint itself (T-024).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
