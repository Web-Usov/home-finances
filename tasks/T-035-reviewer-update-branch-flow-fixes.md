---
id: T-035
title: "Reviewer update-branch flow fixes"
status: done          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: infra             # api | mobile | infra | docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-035-reviewer-update-branch-flow-fixes          # set when work starts, e.g. task/T-000-slug
pr: https://github.com/Web-Usov/home-finances/pull/20              # PR URL once opened
---

# T-035. Reviewer update-branch flow fixes

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [x]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

Fix the minor findings of the PR #18 review: the reviewer's update-branch step (`gh api -X PUT .../pulls/<n>/update-branch`) is explicitly allowed, merge-only, and no
longer sends nearly every PR back to the author; `tasks:check` and `task:clean` give safer messages/behavior.

## Context

- `.opencode/agents/reviewer.md`, `.opencode/commands/review.md`, `docs/workflow.md` section 6.
- `scripts/tasks.mjs` (id collision rule), `scripts/task-clean.mjs` (`resolveBranch`), `scripts/__tests__/`.
- Review comment on PR #18, findings 1-5.

## Definition of Done

- [x] reviewer.md states `gh api -X PUT repos/Web-Usov/home-finances/pulls/<n>/update-branch` as the only allowed branch modification
- [x] permissions: allow that exact `gh api -X PUT` form, then deny `gh api * update_method*` (last match wins); gh v2.45 has no `pr update-branch`
- [x] reviewer.md, review.md, workflow.md agree: update-branch conflict => back to the author, otherwise rely on CI + auto-merge
- [x] `tasks:check` collision message suggests `git merge origin/master` first (test asserts it)
- [x] `resolveBranch` errors when `branch:` is set but missing locally; falls back only when null/absent (test)
- [x] `decideClean` allows deleting a branch that is an ancestor of the PR head (unit test)
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- `apps/**`, `scripts/task-start.mjs`.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Fixes findings 1-5 of the PR #18 review (finding 6 needed no change).

- reviewer.md: explicit exception for the update-branch API call (`gh api -X PUT repos/Web-Usov/home-finances/pulls/<n>/update-branch`, because gh v2.45
  has no `gh pr update-branch`); permissions allow exactly that form, then deny `gh api * update_method*` (V2: last match wins;
  patterns support only `*` and `?`, so `[0-9]*` would be literal). Everything else stays denied by the `shell *` deny. Conflict => back to the author; otherwise CI on the updated head + auto-merge.
- review.md, workflow.md section 6 aligned; the "master changed generated files" condition is dropped.
- `tasks:check` collision message suggests `git merge origin/master` first (test asserts it).
- `resolveBranch`: `branch:` set but missing locally is an error, fallback only for null/absent (tests).
- `decideClean`: new `inPrHead` input (local branch is an ancestor of `headRefOid`, fetched on demand) so a PR head extended by the
  server-side update-branch merge commit no longer blocks `task:clean`; unit-tested.
