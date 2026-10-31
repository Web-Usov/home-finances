---
id: T-012
title: Mobile: history screen with filters, edit and delete
status: todo
epic: E-04
depends: [T-005, T-011, T-046]
blocked_by: []
spec: [UI-03, HIST-01, HIST-02, HIST-03, HIST-04, HIST-07, HIST-08, HIST-10, HIST-11, OP-17, MSG-06]
acceptance: [AC-12, AC-13, AC-14]
area: mobile
size: M
branch: null
pr: null
---

# T-012. Mobile: history screen with filters, edit and delete

## Goal

The "History" tab lists operations of the selected month in insertion order with type, envelopes, amount, covered, uncovered and comment; filters by year, month, envelope and type; edit and delete for unlocked months, read-only for closed months.

## Context

- Placeholder: `apps/mobile/app/(tabs)/history.tsx`. API: `GET /operations` (T-004), `PATCH`/`DELETE` (T-005); generated hooks in `apps/mobile/src/api/operations`.
- Edit reuses the forms from T-011. Deep links with filters (period, envelope, type) are needed by the analytics drill-down in T-013 — expose them as route params.
- Show uncovered amounts visually distinct (not by color alone, NFR-22).

## Definition of Done

- [ ] Mobile tests: `it('HIST-11: default view shows the selected month in insertion order')`, `it('HIST-10 / MSG-06: edit and delete are hidden in a closed month')`, `it('UI-03: filters by envelope and type narrow the list')`
- [ ] Playwright spec `e2e/history.e2e.ts` covering `AC-12` (edit keeps position) and `AC-13` (delete updates balances)
- [ ] Screenshots of list, filtered list and closed-month read-only state attached as artifacts
- [ ] `pnpm verify` is green
- [ ] `pnpm e2e:smoke` is green and a screenshot of the new screen state is attached as a Playwright artifact
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Forms (T-011).
- Pagination beyond what the API returns.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
