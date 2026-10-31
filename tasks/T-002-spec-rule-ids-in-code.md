---
id: T-002
title: Replace "SPECIFICATION.md line NNN" comments with rule IDs
status: done
epic: E-00
depends: []
blocked_by: []
spec: []
acceptance: []
area: docs
size: S
branch: task/T-002-spec-rule-ids-in-code
pr: https://github.com/Web-Usov/home-finances/pull/21
---

# T-002. Replace "SPECIFICATION.md line NNN" comments with rule IDs

## Goal

No code comment refers to spec line numbers or the removed root `SPECIFICATION.md` text; each is replaced by the stable rule ID(s) it meant.

## Context

- Find them: `grep -rnE "SPECIFICATION\.md|spec line" apps packages/types/src --exclude-dir=node_modules --exclude-dir=dist` (~40-47 lines in ~10 files: allocations, calculation-engine, envelopes, months, operations, reporting services/specs, `packages/types/src/entities.ts`, `schemas.ts`).
- Original text for lookup: `docs/archive/SPECIFICATION.md`; new rules: `docs/spec/*.md`. Map each referenced passage to its rule ID (e.g. FIN-13, OP-05).
- Comments only: do not change code behavior. Do not edit `docs/spec/**`.
- WIP branch `wip/operations-income` has the same pattern in `operations.dto.ts`/`operations.service.ts`; fix there is done by T-004, not here.

## Definition of Done

- [x] `grep -rnE "SPECIFICATION\.md|spec line|lines? [0-9]+" apps packages/types/src --exclude-dir=node_modules --exclude-dir=dist` finds no spec references
- [x] `node scripts/spec-check.mjs` passes (all new references resolve to defined IDs)
- [x] Diff contains only comment changes (verify with `git diff --stat` and review)
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Any behavioral change.
- Spec edits.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Replaced 46 "SPECIFICATION.md line(s) NNN" / "spec line NNN" references (api services and specs, `packages/types` schemas/entities) with rule IDs, mapped through `docs/archive/SPECIFICATION.md` and `docs/spec/*.md`. Comments only.

Mapping notes: ranges cite every rule they span (e.g. 263-296 -> ENV-01..ENV-13, 233-262 -> CALC-01..CALC-13, 142-187 -> OP-01..OP-14). Archive lines 182-184 and 186 are the formula and dashboard note of OP-14 (negative adjustment). `schemas.ts` "line 68" -> FIN-02 and "line 82" -> FIN-08 (the original line numbers pointed at stale positions; matched by text). Line 241 -> CALC-04. No uncertain mappings.

Guard: `scripts/spec-check.mjs` now fails on `SPECIFICATION.md ... line N` and `spec(ification) line(s)` in hand-written source (apps/*/src, apps/*/test, packages/*/src, e2e, scripts; generated `apps/mobile/src/api`, `docs/archive`, spec-check itself and `scripts/__tests__` excluded). Unit test: `scripts/__tests__/spec-check.test.mjs`.
