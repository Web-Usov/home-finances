---
id: T-040
title: "Spec follow-ups batch 2"
status: done          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: docs             # api | mobile | infra | docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-040-spec-follow-ups-batch-2          # set when work starts, e.g. task/T-000-slug
pr: https://github.com/Web-Usov/home-finances/pull/33              # PR URL once opened
---

# T-040. Spec follow-ups batch 2

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

Process planner follow-ups 9-20 (`/root/.opencode/plan/planner-followups.md`): spec edits for the gaps that need a human decision and tasks T-041..T-046 for the pure code work.

## Context

- Spec: API-18/19 (OPERATION_NOT_FOUND), new API-23, API-24, HIST-13, HIST-14, HIST-15, UI-17, NFR-30, Q-05.
- Already resolved on master (skipped): 10 (T-032), 13 (T-033), 16 (T-037 exists), 8 (T-025 / API-21), 14 partly (see T-046).

## Definition of Done

- [x] `pnpm spec:check`, `pnpm tasks:check`, `pnpm verify:quick` green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Implementing the new tasks.

## Handoff log

<!-- Append-only. -->

## Result

Docs-only PR; see the PR body for decisions and the task list.
