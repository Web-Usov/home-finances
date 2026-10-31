---
id: T-024
title: Reopen preview endpoint GET /months/:period/reopen-preview
status: todo
epic: E-01
depends: [T-006, T-020]
blocked_by: []
spec: [API-06, API-20, MON-12, MON-13, MON-14]
acceptance: [AC-15]
area: api
size: S
branch: null
pr: null
---

# T-024. Reopen preview endpoint GET /months/:period/reopen-preview

## Goal

A read-only endpoint returns the recalculation range that reopening a closed month would produce, so the UI can show the MON-12 warning before the user confirms.

## Context

- Spec: API-20, MON-12. Reuse the range computation used by `POST /months/:period/reopen` in `apps/api/src/modules/months/months.service.ts` (extract a shared private function; one source of truth).
- Response schema `ReopenPreviewSchema = { month: MonthSummary, recalcRange: { from, to } }` in `packages/types`; no `version`, no mutation envelope, nothing is written.
- Mobile part: `apps/mobile/src/components/month/ReopenConfirm.tsx` (T-009) already accepts an optional `recalcRange` prop. T-024 is api-only; the mobile wiring (call the generated preview hook before showing the confirm, pass `recalcRange`) is filed as T-036 (mobile, depends on T-024).
- Errors identical to reopen: 404 `MONTH_NOT_FOUND`, 409 `INVALID_STATUS_TRANSITION` (not closed, or another month is already reopened, MON-13).

## Definition of Done

- [ ] `it('MON-12 / API-20 / AC-15: preview returns the same range as the reopen response')` (int-spec) passes
- [ ] `it('API-20: preview does not change status, version or results')` passes
- [ ] `it('API-20 / MON-13: preview of a second month while one is reopened answers 409 INVALID_STATUS_TRANSITION')` passes
- [ ] `it('API-20: preview of an open month answers 409 INVALID_STATUS_TRANSITION and of an unknown one 404 MONTH_NOT_FOUND')` passes
- [ ] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Mobile warning dialog (T-009).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
