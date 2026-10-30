---
id: T-003
title: Months: update income with cascade recalculation
status: in_progress
epic: E-01
depends: [T-001]
blocked_by: []
spec: [API-03, FIN-02, FIN-06, MON-03, NFR-18, API-15, API-16, DATA-12, MSG-01, MSG-06]
acceptance: [AC-02, AC-03, AC-14]
area: api
size: M
branch: task/T-003-months-income-update
pr: null
---

# T-003. Months: update income with cascade recalculation

## Goal

`PATCH /api/v1/months/:period` changes the month income, rejects income below the allocated sum and closed months, recalculates the cascade in one transaction and returns the month summary with warnings.

## Context

- Stub: `apps/api/src/modules/months/months.service.ts` `updateIncome` (throws/returns "Not implemented" on master).
- Partial implementation exists on branch `wip/operations-income` (`git diff master...wip/operations-income -- apps/api/src/modules/months`). Start from it: `git checkout wip/operations-income -- <files>` or cherry-pick, then finish. The WIP has one failing test (`months.service.spec.ts` ~line 416) and controller typecheck errors — fix them.
- Reference flow for month-scoped mutations: `AllocationsService.save` (existence -> version -> status -> domain rules; see `docs/architecture.md` section 3).
- Schema: `UpdateIncomeRequestSchema` in `packages/types/src/schemas.ts`; use `ZodValidationPipe` in the controller (T-001 makes it 422).
- Rules: API-03, FIN-02 (allocation <= income), MON-03/NFR-18 (closed month locked, server-side), DATA-12 (version).

## Definition of Done

- [ ] Controller body validated by `ZodValidationPipe(UpdateIncomeRequestSchema)` (no `unknown` DTO)
- [ ] `it('FIN-02 / AC-03: income below allocated sum is rejected with ALLOCATION_EXCEEDS_INCOME')`
- [ ] `it('MON-03 / AC-14: income update in a closed month returns MONTH_LOCKED')`
- [ ] `it('AC-02: free funds = income - allocations after income update')`
- [ ] `it('DATA-12: stale version returns VERSION_CONFLICT')`
- [ ] Integration test: income change recalculates later months in one transaction (response has summary + warnings, API-16)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Allocations editing (exists).
- Month close/reopen (T-006).
- UI.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
