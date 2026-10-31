---
id: T-012
title: Mobile: history screen with filters, edit and delete
status: done
epic: E-04
depends: [T-005, T-011]
blocked_by: []
spec: [UI-03, HIST-01, HIST-02, HIST-03, HIST-04, HIST-07, HIST-08, HIST-10, HIST-11, OP-17, MSG-06]
acceptance: [AC-12, AC-13, AC-14]
area: mobile
size: M
branch: task/T-012-history-screen
pr: https://github.com/Web-Usov/home-finances/pull/39
---

# T-012. Mobile: history screen with filters, edit and delete

## Goal

The "History" tab lists operations of the selected month in insertion order with type, envelopes, amount, covered, uncovered and comment; filters by year, month, envelope and type; edit and delete for unlocked months, read-only for closed months.

## Context

- Placeholder: `apps/mobile/app/(tabs)/history.tsx`. API: `GET /operations` (T-004), `PATCH`/`DELETE` (T-005); generated hooks in `apps/mobile/src/api/operations`.
- Edit reuses the forms from T-011. Deep links with filters (period, envelope, type) are needed by the analytics drill-down in T-013 — expose them as route params.
- Show uncovered amounts visually distinct (not by color alone, NFR-22).

## Definition of Done

- [x] Mobile tests: `it('HIST-11: default view shows the selected month in insertion order')`, `it('HIST-10 / MSG-06: edit and delete are hidden in a closed month')`, `it('UI-03: filters by envelope and type narrow the list')`
- [x] Playwright spec `e2e/history.e2e.ts` covering `AC-12` (edit keeps position) and `AC-13` (delete updates balances)
- [x] Screenshots of list, filtered list and closed-month read-only state attached as artifacts
- [x] `pnpm verify` is green
- [x] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Forms (T-011).
- Pagination beyond what the API returns.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Implemented the History tab (`app/(tabs)/history.tsx`, `src/components/history/*`):

- `HistoryView`: month switcher (reuses `PeriodSwitcher`), filters by envelope and type, rows in API order (`sequence_no`) with type, envelope(s), full amount, covered, uncovered (amber row + "⚠ Не покрыто" text, not color only), comment. Deep-link route params `period`, `envelopeId`, `type` preselect the view (for T-013).
- Edit reuses `OperationForm` via a backward-compatible `editing` prop (amount/envelopes/comment; type and sign fixed). PATCH carries the operation month's `version`; a 409 `TRANSFER_EXCEEDS_BALANCE` shows the server message and a one-click replace offer using the server's `result.sourceBalanceBefore` (no client math). The client-side "exceeds balance" pre-warning is off in edit mode (dashboard `closing` already includes the operation); the API answers.
- Delete: inline confirmation, `DELETE ?version=N`. After edit/delete the operations, dashboard, months and envelopes queries are invalidated.
- `initial_balance` rows have no buttons (OP-10); a closed month shows MSG-06 and no buttons (HIST-10).
- Tests: `HistoryView.test.tsx` (9 component tests); `e2e/history.e2e.ts` (3 @smoke: AC-12/AC-13, AC-08 + filter, closed/initial read-only) with 8 attached screenshots (Playwright report artifact).

Deviations: none from the DoD. Filters year/month are covered by the period switcher (same as the Month screen); no separate year picker.
