---
id: T-023
title: Envelope with an initial balance and no month returns MONTH_NOT_FOUND
status: todo
epic: E-00
depends: [T-020]
blocked_by: []
spec: [ENV-03, ENV-14, OP-10, API-18, API-19]
acceptance: [AC-01]
area: api
size: S
branch: null
pr: null
---

# T-023. Envelope with an initial balance and no month returns MONTH_NOT_FOUND

## Goal

`POST /api/v1/envelopes` with `initialBalance > 0` while no month exists answers 404 `MONTH_NOT_FOUND` instead of 409 `MONTH_LOCKED`.

## Context

- Spec: ENV-14, API-19 (merged by T-020). `EnvelopesService.create` in `apps/api/src/modules/envelopes/envelopes.service.ts` throws `ConflictException('MONTH_LOCKED')` when `month === null` and the balance is positive.
- Switch to `NotFoundException('MONTH_NOT_FOUND', ...)`; keep `MONTH_LOCKED` for an existing closed month (MON-03, ENV-05). An envelope without initial balance is still allowed with no month (ENV-14).
- Update `@ApiResponse` of the controller (404 MONTH_NOT_FOUND) and any e2e/int test that expects the old code.

## Definition of Done

- [ ] `it('ENV-14 / API-19: initial balance without any month answers 404 MONTH_NOT_FOUND')` (int-spec, real DB) passes
- [ ] `it('ENV-14: envelope without initial balance is created when no month exists')` passes
- [ ] `it('ENV-05 / MON-03: initial balance in a closed month still answers 409 MONTH_LOCKED')` passes
- [ ] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- UI handling of the error (T-009 / envelope forms).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
