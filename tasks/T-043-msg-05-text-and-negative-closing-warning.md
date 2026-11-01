---
id: T-043
title: "Envelopes: align MSG-05 text with the spec, test negative closing warning"
status: in_progress
epic: E-00
depends: [T-026]
blocked_by: []
spec: [MSG-05, MSG-07, ENV-11]
acceptance: []
area: api
size: S
branch: task/T-043-msg-05-text-and-negative-closing-warning
pr: null
---

# T-043. Envelopes: align MSG-05 text with the spec, test negative closing warning

## Goal

The archive error message uses the spec wording of MSG-05 and the ARCHIVED_ENVELOPE_WITH_BALANCE warning is covered for a negative closing balance.

## Context

- `apps/api/src/modules/envelopes/envelopes.service.ts` (archive error text `Невозможно архивировать конверт «…»: баланс … ₽. …`), `envelopes.http.spec.ts` asserts it.
- Spec MSG-05: «Сначала обнулите конверт. Текущий остаток: X ₽.» with X formatted per MSG-07.
- Warning code: `apps/api/src/modules/calculation-engine/calculation-engine.service.ts` (ARCHIVED_ENVELOPE_WITH_BALANCE).
- T-026 review follow-up.

## Definition of Done

- [ ] `it('MSG-05 / MSG-07: archive of a non-empty envelope answers the verbatim text')` updated in `envelopes.http.spec.ts`
- [ ] `it('ENV-11: ARCHIVED_ENVELOPE_WITH_BALANCE warns when the closing balance of an archived envelope is negative')` in the engine spec
- [ ] `pnpm verify` is green
- [ ] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing the spec text (spec wins; an extension of MSG-05 is a planner task).

## Handoff log

<!-- Append-only. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
