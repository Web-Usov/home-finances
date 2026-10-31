---
id: T-045
title: "Operations: uncoveredOnly and role=source filters for analytics drill-down"
status: todo
epic: E-02
depends: [T-008, T-025]
blocked_by: []
spec: [HIST-15, HIST-11, REP-10]
acceptance: [AC-20]
area: api
size: M
branch: null
pr: null
---

# T-045. Operations: uncoveredOnly and role=source filters for analytics drill-down

## Goal

Analytics drill-down keys (REP-10) open exactly the history rows behind a report number: `GET /operations` supports `role=source` and `uncoveredOnly=true` and the yearly report emits them in `drillDown`.

## Context

- `OperationListQuerySchema` / `AnalyticsDrillDownSchema` in `packages/types/src/schemas.ts`; `operations.service.ts` list; `reporting.service.ts` drill-down keys (T-008).
- Spec: HIST-15 (new). Today `type=adjustment` also returns positive adjustments and `envelopeId` matches the destination of a transfer, so the list is a superset of the number.
- UI T-013 depends on this task.

## Definition of Done

- [ ] `it('HIST-15 / REP-10: uncoveredOnly returns only operations with uncovered > 0')` int test
- [ ] `it('HIST-15 / REP-10: role=source ignores transfers into the envelope')` int test
- [ ] `it('REP-10: drillDown of every non-zero uncovered value returns exactly the rows summing to it')` reporting int test
- [ ] `pnpm api:generate` run, `pnpm api:contract` green
- [ ] `pnpm verify` is green
- [ ] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Mobile screens (T-012, T-013).

## Handoff log

<!-- Append-only. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
