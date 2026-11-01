---
id: T-073
title: "Bind remaining epic rules to tests by rule ID"
status: todo          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [UI-01, UI-04, UI-15, HIST-01, HIST-02, HIST-03, HIST-04, DOD-01, DOD-03, DOD-04, DOD-05, DOD-06, NFR-27, NFR-29]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: api             # api | mobile | infra | docs | design
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: null          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-073. Bind remaining epic rules to tests by rule ID

## Goal

Every rule listed in an epic `spec:` list is referenced by ID from at least one test that really asserts it, so `pnpm spec:check` reports no epic rule without a test reference.

## Context

- `node scripts/spec-check.mjs --verbose` lists rules not referenced from test files; currently uncovered among epic rules: UI-01, UI-04, UI-15, HIST-01..HIST-04, DOD-01, DOD-03, DOD-04, DOD-05, DOD-06, NFR-27, NFR-29 (re-run first: the list may have shrunk).
- Where an existing test already asserts the rule, only add the ID to its name/comment. Where none does, write the test: UI-01 (start screen is Month; tab/sidebar navigation: mobile component or e2e), UI-04 (Analytics year switch, three reports, drill-down), UI-15 (allocation change recalculates existing operations: int test or e2e), HIST-01..04 (operations history behavior, see `docs/spec/50-operations-history.md`), DOD-01/03/04/05/06 (engine branch coverage with uncovered amounts, compose start in `scripts/smoke-compose.sh` documented command, migrations and env docs present, no out-of-MVP controls in the UI), NFR-27 (E2E scenarios first run/regular month/draft/close/correct past; reference from `e2e/**` specs), NFR-29 (see the migration-on-populated-DB task; reference only, do not duplicate).
- Rules whose coverage is a process or document check (DOD-04/05) may be bound to a script test in `scripts/__tests__` that asserts the artifact exists; do not invent weak tests that assert nothing.
- Spec files are not edited (planner owns them); if a rule text is unclear, file a Q-proposal in the Handoff log instead.

## Definition of Done

Every item must be verifiable by a command or a named test.

- [ ] Every rule listed in Context is referenced by ID in the name or a comment of a test that asserts it (list rule -> test file in `## Result`).
- [ ] New tests were written only where none existed and each one fails when the behavior is broken (mutation check noted in `## Result`).
- [ ] `node scripts/spec-check.mjs --verbose` reports none of these rules as unreferenced from tests; no other rule regresses.
- [ ] Tests cite rule IDs in their names; `pnpm test:unit` and `pnpm test:int` pass for touched packages.
- [ ] `pnpm verify` is green (and `pnpm e2e:smoke` if e2e specs changed)
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing spec rule text or deferred-coverage policy (`scripts/spec-coverage-deferred.json`).
- Rules outside epic `spec:` lists.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
