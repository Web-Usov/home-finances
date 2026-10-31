---
id: T-030
title: Keep propertyNames uuid for the allocations map in openapi.json
status: in_progress
epic: E-00
depends: []
blocked_by: []
spec: [API-04]
acceptance: []
area: api
size: S
branch: task/T-030-openapi-allocations-uuid-keys
pr: null
---

# T-030. Keep propertyNames uuid for the allocations map in openapi.json

## Goal

`apps/api/openapi.json` documents allocation map keys as UUIDs again (`propertyNames: { format: uuid }`).

## Context

- Found in the T-006 review: `zodOpenApiSchema` in `apps/api/src/common/swagger-zod.ts` uses `$refStrategy: none` and drops `propertyNames` of `z.record(z.string().uuid(), ...)`. Documentation only; runtime validation is unaffected.
- Fix in the converter (post-process) or by an equivalent schema; the generated Orval client must stay type-correct.

## Definition of Done

- [ ] `it('API-04: openapi.json keeps propertyNames format uuid for the allocations map')` (unit test over the generated document) passes
- [ ] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing request validation.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
