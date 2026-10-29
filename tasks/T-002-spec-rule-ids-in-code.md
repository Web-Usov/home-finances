---
id: T-002
title: Replace "SPECIFICATION.md line NNN" comments with rule IDs
status: todo
epic: E-00
depends: []
blocked_by: []
spec: []
acceptance: []
area: docs
size: S
branch: null
pr: null
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

- [ ] `grep -rnE "SPECIFICATION\.md|spec line|lines? [0-9]+" apps packages/types/src --exclude-dir=node_modules --exclude-dir=dist` finds no spec references
- [ ] `node scripts/spec-check.mjs` passes (all new references resolve to defined IDs)
- [ ] Diff contains only comment changes (verify with `git diff --stat` and review)
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Any behavioral change.
- Spec edits.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
