---
id: T-031
title: Int test: uncovered operations do not block closing a month
status: todo
epic: E-01
depends: [T-004, T-006]
blocked_by: []
spec: [MON-10, MON-11, OP-06]
acceptance: [AC-14]
area: api
size: S
branch: null
pr: null
---

# T-031. Int test: uncovered operations do not block closing a month

## Goal

A regression test proves that a month with uncovered expenses closes normally (MON-10, MON-11).

## Context

- T-006 could not test it because operations did not exist; they do since T-004. Test only, in `apps/api` int-specs next to the close tests. Fix the code only if the test fails (then report it in Result).

## Definition of Done

- [ ] `it('MON-10 / MON-11: month with an uncovered expense closes without warnings or errors')` (int-spec) passes
- [ ] `it('MON-11: close is still blocked when allocation exceeds income')` passes
- [ ] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Any change of close rules.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
