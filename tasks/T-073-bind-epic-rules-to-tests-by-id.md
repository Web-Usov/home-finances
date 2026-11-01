---
id: T-073
title: "Bind remaining epic rules to tests by rule ID"
status: done          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [UI-01, UI-04, UI-15, HIST-01, HIST-02, HIST-03, HIST-04, DOD-01, DOD-03, DOD-04, DOD-05, DOD-06, NFR-27, NFR-29]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: api             # api | mobile | infra | docs | design
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-073-bind-epic-rules-to-tests-by-id          # set when work starts, e.g. task/T-000-slug
pr: https://github.com/Web-Usov/home-finances/pull/65              # PR URL once opened
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

- [x] Every rule listed in Context is referenced by ID in the name or a comment of a test that asserts it (list rule -> test file in `## Result`).
- [x] New tests were written only where none existed and each one fails when the behavior is broken (mutation check noted in `## Result`).
- [x] `node scripts/spec-check.mjs --verbose` reports none of these rules as unreferenced from tests; no other rule regresses.
- [x] Tests cite rule IDs in their names; `pnpm test:unit` and `pnpm test:int` pass for touched packages.
- [x] `pnpm verify` is green (and `pnpm e2e:smoke` if e2e specs changed)
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing spec rule text or deferred-coverage policy (`scripts/spec-coverage-deferred.json`).
- Rules outside epic `spec:` lists.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

PR: see the `pr:` field. NFR-29 was already bound by T-072 (PR #62, `apps/api/src/prisma/migrations.populated-db.int-spec.ts`); verified, not touched.

| Rule | Test | Status |
|------|------|--------|
| UI-01 | `e2e/smoke/app.e2e.ts` "UI-01: opens on the Month dashboard; the bottom navigation switches..." | renamed; **phone half only** (see finding) |
| UI-04 | `e2e/analytics.e2e.ts` "UI-04: the year switcher loads the neighbouring year..." (new) and the three reports + drill-down test (renamed) | new + renamed |
| UI-15 | `acceptance.mvp-scenarios.int-spec.ts` "UI-15: changing a distribution recalculates the operations already added to this and the later months" | new |
| HIST-01..HIST-04 | `apps/api/src/modules/operations/operations.history-fields.int-spec.ts` (one test per rule) | new |
| DOD-01 | `acceptance.mvp-scenarios.int-spec.ts` "AC-22 / DOD-01: ... after a server restart and after rebuilding from source" | renamed |
| DOD-03 | `calculation-engine.service.spec.ts`: 8 tests with uncovered amounts (expense, transfer, negative adjustment, engine recalculation) prefixed `DOD-03:`; engine branch coverage 87 %, the uncovered lines are not uncovered-amount branches | renamed |
| DOD-04 | `scripts/__tests__/repo-state.rules.test.mjs` (README command, compose services and start order, smoke script runs `up`) | new (repo-state test) |
| DOD-05 | same file: migrations committed, every compose variable in `.env.example` and README, README sections | new (repo-state test) |
| DOD-06 | same file: only the four sections as routes, no out-of-MVP words (SCOPE-16..22) and no stub markers in UI sources | new (repo-state test; static scan, not a rendered-UI check) |
| NFR-02 (E-00, also unbound) | same file: NestJS dependency, one Nest module per domain, controllers never touch Prisma | new (repo-state test) |
| NFR-27 | `e2e/journeys/{first-launch,regular-month,draft-and-close,correct-the-past}.e2e.ts` (first run / regular month / draft+close / correct the past) | renamed |
| NFR-29 | T-072 test above | already covered |

Mutation checks: UI-15 test fails with the recalculation after `PUT /allocations` removed; HIST tests fail when the operation destination is not stored (HIST-03 for the right reason, the others because setup breaks); DOD-06 fails with a `TODO` in a UI file; DOD-04 fails when the README launch command changes.

Strict mode: `node scripts/spec-check.mjs --strict-epics` fails if a rule from any `epics/E-*.md` `spec:` list has no test reference; allowlist `scripts/spec-epics-deferred.json` (empty: nothing needed an exception), wired into `pnpm verify` (`spec:check` step), documented in `docs/testing.md`. `scripts/__tests__/*.rules.test.mjs` now count as test files for coverage.

**Finding (not fixed, outside this task):** the wide-screen half of UI-01 (sidebar from 768 px) is not implemented: `apps/mobile/app/(tabs)/_layout.tsx` hides the tab bar at width >= 768 and renders no sidebar, so on a wide screen there is no navigation at all. A wide-viewport e2e test failed accordingly and was not committed. Needs a follow-up implementation task (planner to decide).
