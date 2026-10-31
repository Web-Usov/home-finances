---
id: T-029
title: Re-check month version inside the transaction in allocations.save and other mutations
status: todo
epic: E-00
depends: []
blocked_by: []
spec: [DATA-12, API-15, NFR-18]
acceptance: []
area: api
size: S
branch: null
pr: null
---

# T-029. Re-check month version inside the transaction in allocations.save and other mutations

## Goal

Every month-scoped mutation checks `version` and status on the row locked inside the transaction, so a concurrent write cannot slip between the check and the write.

## Context

- Found in the T-003 review: `AllocationsService.save` (`apps/api/src/modules/allocations/allocations.service.ts`) reads the month and compares the version outside `prisma.$transaction`. Pattern to copy: `OperationsService.create` (`lockMonth` + `assertVersion` inside the tx).
- Audit `months.service.ts` (update income, close, reopen) and `envelopes.service.ts` for the same pattern and fix them.

## Definition of Done

- [ ] `it('ADR 0005: concurrent PUT allocations with the same version: one succeeds, the other answers 409 VERSION_CONFLICT')` (int-spec) passes
- [ ] Same kind of test for `PATCH /months/:period` income
- [ ] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Response shape changes (T-027).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
