---
id: T-033
title: "Task id allocation sees task files of all remote branches"
status: done          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: infra             # api | mobile | infra | docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-033-task-id-allocation          # set when work starts, e.g. task/T-000-slug
pr: https://github.com/Web-Usov/home-finances/pull/18              # PR URL once opened
---

# T-033. Task id allocation sees task files of all remote branches

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

`pnpm task:start --new` never hands out an id already used by a task file of an unmerged PR branch, and `tasks:check` fails
when a branch's task id collides with a different task file on `origin/master`.

## Context

- Bug: `--new` took ids from task files on `origin/master` plus task branch names only; PR #12 (branch `task/T-020-...`)
  carries T-023..T-031, so T-023 was issued twice.
- `scripts/task-start.mjs` (`collectTaskIds`), `scripts/tasks.mjs` (`check`), `docs/workflow.md` section 2 and 5.

## Definition of Done

- [x] `collectTaskIds` reads task files from `origin/master`, every `refs/remotes/origin/*` and local branch, plus branch names (`scripts/__tests__/task-start.test.mjs`)
- [x] `--new` skips ids held by task files of unmerged branches (test with a throwaway origin)
- [x] `tasks:check` fails on an id used by a different file on `origin/master`, skips without the ref (`scripts/__tests__/tasks.test.mjs`)
- [x] CI `verify` job fetches `origin/master` so the rule runs there
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Renumbering existing tasks; reserving ids on a shared registry.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Id allocation now scans task files on all remote/local refs; `tasks:check` reports cross-branch id collisions with
`origin/master`. Note: on PR CI the merge ref already makes a clash a "duplicate task id"; the new rule catches it locally
and when the merge is textually clean. Not covered: two branches that both allocate the same id before either is pushed.
