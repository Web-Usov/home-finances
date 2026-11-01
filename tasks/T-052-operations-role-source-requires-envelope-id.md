---
id: T-052
title: "Operations: role=source without envelopeId is a 422"
status: in_progress
epic: E-02
depends: [T-045]
blocked_by: []
spec: [HIST-15]
acceptance: []
area: api
size: S
branch: task/T-052-operations-role-source-requires-envelope-id
pr: null
---

# T-052. Operations: role=source without envelopeId is a 422

## Goal

`GET /operations?role=source` without `envelopeId` returns 422 `VALIDATION_ERROR` instead of silently ignoring `role` (HIST-15, updated in the spec by T-051).

## Context

- `OperationListQuerySchema` in `packages/types/src/schemas.ts` (add a refinement) and the list handler in `apps/api/src/operations/`.
- Spec: HIST-15, API-17/API-18 (VALIDATION_ERROR). Regenerate OpenAPI if the schema changes (`pnpm api:generate`).
- Check that the mobile history/analytics drill-down always passes `envelopeId` together with `role=source` (T-045).

## Definition of Done

- [ ] `it('HIST-15: role=source without envelopeId returns 422 VALIDATION_ERROR')` int test passes
- [ ] `it('HIST-15: role=source with envelopeId still filters by source')` keeps passing
- [ ] `pnpm api:generate` run, `pnpm api:contract` green
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Any other filter change.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
