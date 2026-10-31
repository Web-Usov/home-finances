---
id: T-022
title: "Process stability: conflict-free board, robust script tests"
status: in_progress          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: infra             # api | mobile | infra | docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-022-process-stability-conflict-free-board          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-022. Process stability: conflict-free board, robust script tests

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

Make the process tooling stable under parallel work: the generated board never carries cross-task aggregates (no silent
wrong counters after squash merges), and the script tests are deterministic under load, leak nothing and cannot touch the real repo.

## Context

- `scripts/tasks.mjs` (board), `scripts/task-start.mjs`, `scripts/with-lock.mjs`, `scripts/__tests__/*.test.mjs`, `docs/workflow.md`, `docs/testing.md`.
- Observed: two parallel PRs regenerating `tasks/README.md` merged textually clean but left wrong counters on master.

## Definition of Done

- [x] Board has no aggregate counters; one block per task, tasks separated by blank lines, sorted by epic then id; summary is printed by `tasks:board` / `tasks:next` to stdout
- [x] `tasks.test.mjs`: two independent status changes merged with `git merge-file` equal the freshly generated board
- [x] script tests wait on conditions with generous deadlines (no fixed sleeps as synchronisation); `test:scripts` has a per-test timeout; 10x loop under CPU load is green
- [x] tests remove their `mkdtemp` dirs (and worktrees) in `after` hooks
- [x] `task:start` install step has no short timeout, uses `--prefer-offline`, and prints a clear rolled-back / kept + resume message on failure
- [x] test helpers set `GIT_CEILING_DIRECTORIES` and assert `core.bare` of the real repo is not `true` after each test
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Things that belong to other tasks.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

1. Board: no counters; one block per task (blank-line separated so adjacent tasks merge cleanly), sorted by epic then id; epic `(done/total)` removed, "no tasks" placeholder removed. Summary printed by `tasks:board`/`tasks:next`. New `tasks.test.mjs` merges two changes of adjacent tasks with `git merge-file` and compares with the regenerated board.
2. Script tests: fixed sleeps replaced by `waitFor` (60s deadline; SIGINT test waits for the "waiting" message), `--test-timeout=300000`. Stress: 6 busy loops + 3 parallel copies, every test file x10 each (120 runs, load average ~12 on 4 CPUs): 0 failures.
3. `makeTmp`/`installGuards` remove all temp dirs in `after`; 120 stress runs leaked nothing.
4. `task:start`: `pnpm install --frozen-lockfile --prefer-offline`, no timeout in the script (the timeout seen came from the caller), explicit rolled-back / kept + resume messages.
5. `helpers.mjs`: `GIT_CEILING_DIRECTORIES` = tmp root and a per-test `core.bare` guard.