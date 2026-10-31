---
id: T-023
title: Envelope with an initial balance and no month returns MONTH_NOT_FOUND
status: in_progress
epic: E-00
depends: [T-020]
blocked_by: []
spec: [ENV-03, ENV-14, OP-10, API-18, API-19]
acceptance: [AC-01]
area: api
size: S
branch: task/T-023-initial-balance-month-not-found
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

- [x] `it('ENV-14 / API-19: initial balance without any month answers 404 MONTH_NOT_FOUND')` (int-spec, real DB) passes
- [x] `it('ENV-14: envelope without initial balance is created when no month exists')` passes
- [x] `it('ENV-05 / MON-03: initial balance in a closed month still answers 409 MONTH_LOCKED')` passes
- [x] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- UI handling of the error (T-009 / envelope forms).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

- `EnvelopesService.create`: initial balance > 0 with no month now throws 404 `MONTH_NOT_FOUND` (ENV-14, API-19); `MONTH_LOCKED` stays for a closed month. Controller `@ApiResponse` 404 added; `openapi.json` regenerated (mobile client unchanged).
- PR #25 follow-up in the same module: `rethrowDuplicateName` maps only a P2002 whose `meta.target` is the envelope `name` unique index to `ENVELOPE_NAME_DUPLICATE`, other P2002 are rethrown; a displayOrder-only update no longer yields an empty name in the message (falls back to the current name).
- Mobile: Envelopes create form shows the API message via `getApiErrorMessage`, so the Russian text of the 404 is displayed as is; no code change.
