---
id: T-070
title: "Follow-up tasks batch 4: docker migrate offline, migration data test, rule bindings"
status: in_progress          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: docs             # api | mobile | infra | docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-070-follow-up-tasks-batch-4-docker-migrate          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-070. Follow-up tasks batch 4: docker migrate offline, migration data test, rule bindings

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

File planner follow-up batch 4 as `todo` tasks: T-071 (docker migrate offline), T-072 (NFR-29 populated-DB migrations), T-073 (bind remaining epic rules to tests), T-074 (test:scripts vs inherited lock env, found while filing this batch).

## Context

- `/root/.opencode/plan/planner-followups.md` items 24 and 25. Item 24 (task:start --new id race) is already covered by T-057 (PR #56, merged); item 25 = T-071.

## Definition of Done

- [x] Tasks T-071..T-074 exist as `todo` with Goal, Context, verifiable DoD, Out of scope.
- [x] `pnpm tasks:check` and `pnpm tasks:board` pass.
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Implementing any of the filed tasks.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Filed T-071..T-074 (todo). Follow-up items 24 and 25 marked PROCESSED in the planner follow-ups file.
