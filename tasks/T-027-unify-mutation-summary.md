---
id: T-027
title: Unify month mutation response shape (data.summary)
status: todo
epic: E-01
depends: [T-020, T-029]
blocked_by: []
spec: [API-03, API-04, API-10, API-11, API-16, API-22]
acceptance: [AC-02]
area: api
size: M
branch: null
pr: null
---

# T-027. Unify month mutation response shape (data.summary)

## Goal

Implement API-22 (Q-04 option B, decided 2026-10-31): `PATCH /months/:period`, `PUT /months/:period/allocations` and the operation mutations return `data.summary: MonthSummary` (short summary); envelope balances come from `GET /dashboard/monthly` only.

## Context

- Spec: API-22. Endpoints that change: `PATCH /months/:period` (today `data` = `MonthSummary` directly -> `data: { summary }`); `PUT /months/:period/allocations` (today `data` = full summary with envelope snapshots -> `data: { summary }` with the short `MonthSummary`, drop `buildSummary` envelope data in `allocations.service.ts`); `PATCH`/`DELETE /operations/:id` (T-005, check that they return `data.summary`; `POST /operations` already does). `POST .../close` and `POST .../reopen` keep their `month` field (API-22 exception) - do not rename.
- Types: add/adjust response schemas in `packages/types/src/schemas.ts` (`mutationResponseSchema(z.object({ summary: MonthSummarySchema }))`); remove the now unused full-summary schema if nothing else uses it.
- Regenerate the Orval client (`pnpm api:generate`). Mobile callers of the changed endpoints (grep `apps/mobile` for the generated hooks `useUpdateIncome`/allocations/operations hooks) must be adapted in this PR or the build breaks; T-010 builds on the new shape.

## Definition of Done

- [ ] `it('API-22 / API-16: PATCH months, PUT allocations and POST/PATCH/DELETE operations return data.summary of MonthSummary')` (int-spec) passes
- [ ] `it('API-22: PUT allocations response has no envelope snapshots')` passes
- [ ] Existing int-specs, e2e helpers and mobile callers are updated to the new shape; `pnpm typecheck` is green
- [ ] `pnpm api:generate` was run and `pnpm api:contract` shows no drift
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- New mobile screens (T-010); only adapt existing callers to the changed response.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
