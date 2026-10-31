---
id: T-027
title: Unify month mutation response shape (data.summary)
status: in_progress
epic: E-01
depends: [T-020, T-029]
blocked_by: []
spec: [API-03, API-04, API-10, API-11, API-16, API-22]
acceptance: [AC-02]
area: api
size: M
branch: task/T-027-unify-mutation-summary
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

- [x] `it('API-22 / API-16: PATCH months, PUT allocations and POST/PATCH/DELETE operations return data.summary of MonthSummary')` (int-spec) passes
- [x] `it('API-22: PUT allocations response has no envelope snapshots')` passes
- [x] Existing int-specs, e2e helpers and mobile callers are updated to the new shape; `pnpm typecheck` is green
- [x] `pnpm api:generate` was run and `pnpm api:contract` shows no drift
- [x] `pnpm verify` is green
- [x] Extended scope (orchestrator decision): `PUT /months/:period/allocations` accepts an optional `income` (decimal string); income update + allocations replace run in ONE transaction under one `lockMonthForMutation` version check with one cascade recalculation; FIN-02 is validated against the NEW income (MSG-01 on overflow)
- [x] `it('FIN-02 / UI-11 / API-04: income + allocations are saved atomically ...')` (int-spec): both applied, version bumped once, `data.summary` has the new income
- [x] `it('FIN-02 / MSG-01: allocations above the NEW income return 422 and nothing is saved')` (int-spec): income and allocations unchanged, version unchanged
- [x] Follow-ups from the PR #25 review: ValidationException import indentation fixed in `months.service.ts`; `docs/architecture.md` and `apps/api/AGENTS.md` document that working-month mutations answer 409 VERSION_CONFLICT when the working month changes under the lock (re-resolution)
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- New mobile screens (T-010) and adapting the parked T-010 branch; only adapt existing mobile callers on master to the changed responses.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Response shape unified (API-22) and income + allocations saved atomically.

- `PATCH /months/{period}`: `data` = `MonthSummary` -> `data: { summary }`. `PUT /months/{period}/allocations`: `data` = full summary with `envelopes[]` snapshots -> `data: { summary }` (short `MonthSummary`, no envelope data). Operation mutations already returned `data.summary` (T-004/T-005, now asserted in one int test); close/reopen keep `month`.
- `PUT .../allocations` body gains optional `income` (decimal string): income update + allocations replace in one transaction, one `lockMonthForMutation` version check, one cascade; FIN-02 against the new income, MSG-01 on overflow (422, nothing saved); version bumps once. Without `income` the stored income is kept.
- Types: `MonthSummaryResultSchema` / `MonthSummaryResponseSchema` in `packages/types`; the unused `MonthSummary`/`EnvelopeSnapshot` interfaces were removed; `DeleteOperationResponseSchema` aliases the new schema. New `common/month-summary.ts` (`buildMonthSummary`) used by allocations.
- Mobile on master: no code change needed (`IncomeForm` ignores the response body); generated client regenerated.
- PR #25 follow-ups: import indentation fixed in `months.service.ts`; 409 VERSION_CONFLICT on working-month re-resolution documented in `docs/architecture.md` and `apps/api/AGENTS.md`.
- Tests: `allocations.save.int-spec.ts` (9 tests), updated unit specs and `months.income-update.int-spec.ts`.
- Hygiene: T-029 (superseded by T-036, PR #25) and T-031 (delivered by T-005, PR #13) marked done; every T-029 DoD item verified against master; the T-031 test titles differ from the DoD wording but assert the same behaviour.
- Note: T-027 was claimed manually (worktree + `tasks.mjs set`) because `task:start` requires `depends` done on `origin/master`.
- Follow-up for the planner: the parked T-010 editor can drop its two-call save and send `income` with the allocations.
- Flaky: `FirstMonthForm.test.tsx` once timed out (5 s) under load during the first verify; it passes alone and in the second full run.
