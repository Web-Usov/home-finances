---
id: T-074
title: "Fix test:scripts failing inside task:start --new (inherited FAMILY_BUDGET_LOCKS_HELD)"
status: in_progress          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: infra             # api | mobile | infra | docs | design
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-074-test-scripts-ignore-inherited-lock-env          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-074. Fix test:scripts failing inside task:start --new (inherited FAMILY_BUDGET_LOCKS_HELD)

## Goal

`pnpm task:start --new` claim commit succeeds: the pre-commit `test:scripts` no longer fails because the hook runs while `task-id` is held by the parent process.

## Context

- Observed (batch 4 planning): `task:start --new` makes the claim commit while holding the `task-id` lock; its env `FAMILY_BUDGET_LOCKS_HELD=task-id` leaks into the pre-commit `verify:quick`, so `scripts/__tests__/task-start.test.mjs` (concurrent --new: "duplicate ids: T-031,T-031,T-031") and `scripts/__tests__/with-lock.test.mjs` ("FAMILY_BUDGET_LOCKS_HELD sees `task-id,t` !== `t`") fail, the commit is rejected and task:start rolls back. Reproducible by running `pnpm test:scripts` with `FAMILY_BUDGET_LOCKS_HELD=task-id`. Workaround used: `--keep`, then `env -u FAMILY_BUDGET_LOCKS_HELD git commit`.
- Files: `scripts/task-start.mjs`, `scripts/lib/lock.mjs`, `scripts/with-lock.mjs`, `scripts/__tests__/*.test.mjs`.
- Fix options: unset/strip the lock-held env for the `git commit` child in `task-start.mjs` (the hook then runs outside the lock; the lock only needs to cover id allocation + push), and/or make the script tests sanitize their env (delete `FAMILY_BUDGET_LOCKS_HELD` in the spawned children and in the test process).

## Definition of Done

Every item must be verifiable by a command or a named test.

- [ ] A test sets `FAMILY_BUDGET_LOCKS_HELD=task-id` in the environment and runs the affected script tests/spawns: they pass (regression test for the leak).
- [ ] `pnpm task:start --new "<title>" --epic E-00 --area docs --size S` creates the claim commit on a clean checkout without `--keep` (manual check noted in `## Result`).
- [ ] Concurrent `--new` calls still get distinct ids (existing test stays green).
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing the lock implementation semantics.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
