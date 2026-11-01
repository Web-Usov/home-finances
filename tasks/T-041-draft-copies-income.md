---
id: T-041
title: "Months: new month copies income from the previous month"
status: in_progress
epic: E-01
depends: [T-032, T-027]
blocked_by: []
spec: [MON-17, MON-01, MON-07, FIN-02, SCOPE-29]
acceptance: [AC-02]
area: api
size: S
branch: task/T-041-draft-copies-income
pr: null
---

# T-041. Months: new month copies income from the previous month

## Goal

A newly created month (draft or open) satisfies FIN-02 from the start. Implement MON-17 (decision Q-05, option A): copy the previous month income when the request has no `income`; the first month takes `income` from the request or 0.

## Context

- `apps/api/src/modules/months/months.service.ts` `create` (income defaults to 0, `copyAllocations` copies the previous allocations).
- Spec: MON-17 (resolves Q-05, decided 2026-11-01).
- Mobile impact: allocation editor prefill (T-010) shows income from the draft; no client change expected.

## Definition of Done

- [x] `it('MON-17 / FIN-02 / SCOPE-29: ...')` int test: a draft created after a month with income 100000 and allocations 75000 has income 100000 (option A) and free 25000
- [x] Snapshots are still built on creation (T-032); month `version` bumped as before
- [x] `it('MON-17: explicit income wins over the copied one; income below the copied allocations answers 422 ALLOCATION_EXCEEDS_INCOME')`
- [x] `it('MON-17: the first month takes income from the request or 0')`
- [x] `pnpm verify` is green
- [x] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- UI changes.
- Copying income for the first month (nothing to copy).

## Handoff log

<!-- Append-only. -->

## Result

`MonthsService.create` now takes the new month's income from the request `income`, else from the latest existing month, else 0 for the first month (MON-17). The active allocations of the previous month are read first; if their total exceeds the resulting income the request fails with 422 `ALLOCATION_EXCEEDS_INCOME` (MSG-01, ru-RU amount) before anything is written. Cascade/recalc and the version bump are unchanged (T-032).

Tests: unit (`months.service.spec.ts`, distinct `tx`), int `months.create-income.int-spec.ts` (copy, explicit wins, 422 creates nothing, first month, open-after-closed). Two existing unit fixtures got a consistent previous income (FIN-02).

Mobile: no client change needed: "Создать следующий" (`MonthActions`) already sends only `period`, `FirstMonthForm` sends `income` only when filled. E2E adapted: `allocation-editor` (draft now shows income 100 000 / free 25 000; the negative-free/overflow display is exercised by lowering the draft income to 60 000 in the editor, and by the existing `MonthDashboard`/`AllocationEditor` component tests), `analytics` (February copies income, year total 200 000).
