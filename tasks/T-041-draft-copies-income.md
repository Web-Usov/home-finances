---
id: T-041
title: "Months: new month copies income from the previous month"
status: todo
epic: E-01
depends: [T-032, T-027]
blocked_by: [Q-05]
spec: [MON-01, MON-07, FIN-02, SCOPE-29]
acceptance: [AC-02]
area: api
size: S
branch: null
pr: null
---

# T-041. Months: new month copies income from the previous month

## Goal

A newly created month (draft or open) satisfies FIN-02 from the start. Implement the option chosen in Q-05 (recommended: A, copy the previous month income when the request has no `income`).

## Context

- `apps/api/src/modules/months/months.service.ts` `create` (income defaults to 0, `copyAllocations` copies the previous allocations).
- Spec: Q-05 in `docs/spec/99-open-questions.md` (options A/B/C); update the task to the human decision before starting.
- Mobile impact: allocation editor prefill (T-010) shows income from the draft; no client change expected.

## Definition of Done

- [ ] `it('FIN-02 / SCOPE-29: ...')` int test: a draft created after a month with income 100000 and allocations 75000 has income 100000 (option A) and free 25000
- [ ] Snapshots are still built on creation (T-032); month `version` bumped as before
- [ ] Explicit `income` in the request wins over the copied one
- [ ] `pnpm verify` is green
- [ ] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- UI changes.
- Copying income for the first month (nothing to copy).

## Handoff log

<!-- Append-only. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
