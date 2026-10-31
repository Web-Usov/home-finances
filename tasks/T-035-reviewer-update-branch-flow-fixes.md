---
id: T-035
title: "Reviewer update-branch flow fixes"
status: in_progress          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: infra             # api | mobile | infra | docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-035-reviewer-update-branch-flow-fixes          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-035. Reviewer update-branch flow fixes

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

One or two sentences: the observable outcome.

## Context

- Files and modules to start from (paths).
- ADRs (`docs/decisions/NNNN-*.md`) and spec rule IDs (never line numbers).
- WIP to reuse, e.g. branch `wip/operations-income`.

## Definition of Done

Every item must be verifiable by a command or a named test.

- [ ] `it('OP-05 / AC-06: ...')` passes
- [ ] `pnpm verify` is green
- [ ] For UI tasks: mobile component tests and `pnpm e2e:smoke` (or a named e2e spec) are green; screenshot attached as artifact
- [ ] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [ ] API tasks that mutate financial data: a test asserts the cascade bumped the BudgetMonth `version` (ADR 0005); drop this line otherwise
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Things that belong to other tasks.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->