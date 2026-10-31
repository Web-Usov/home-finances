---
id: T-031
title: Int test: uncovered operations do not block closing a month
status: done
epic: E-01
depends: [T-004, T-006]
blocked_by: []
spec: [MON-10, MON-11, OP-06]
acceptance: [AC-14]
area: api
size: S
branch: null
pr: https://github.com/Web-Usov/home-finances/pull/13
---

# T-031. Int test: uncovered operations do not block closing a month

## Goal

A regression test proves that a month with uncovered expenses closes normally (MON-10, MON-11).

## Context

- T-006 could not test it because operations did not exist; they do since T-004. Test only, in `apps/api` int-specs next to the close tests. Fix the code only if the test fails (then report it in Result).

## Definition of Done

- [x] `it('MON-10 / MON-11: month with an uncovered expense closes without warnings or errors')` (int-spec) passes
- [x] `it('MON-11: close is still blocked when allocation exceeds income')` passes
- [x] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Any change of close rules.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Delivered by T-005 (PR #13); verified on master, no code change.

- `operations.update-delete.int-spec.ts`: `MON-10 / MON-11: uncovered operations do not block month close` (close returns 200, `warnings: []`) and `MON-10 / OP-08: a transfer made uncovered by a cascade does not block month close either`.
- `months.close-reopen.int-spec.ts`: `MON-11: allocations above income block closing; MON-10: free funds and uncovered operations do not` (422 ALLOCATION_EXCEEDS_INCOME).
- The test titles differ from the DoD wording but assert the same behaviour.
