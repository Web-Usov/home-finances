---
id: T-051
title: "Spec follow-ups batch 3"
status: done          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-051-spec-follow-ups-batch-3          # set when work starts, e.g. task/T-000-slug
pr: https://github.com/Web-Usov/home-finances/pull/51              # PR URL once opened
---

# T-051. Spec follow-ups batch 3

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

Clarify five small spec points (API-25, API-27, MON-17, HIST-15) and propose ADR 0013 (delivery topology); file the resulting code/infra tasks T-052..T-057.

## Context

- Planner follow-ups 21-23. Spec: API-25, API-27, MON-17, HIST-15. ADR proposal from T-016.

## Definition of Done

- [x] Spec edits applied in docs/spec (RU, no new IDs)
- [x] ADR 0013 added with status «Предложено» and listed in docs/decisions/README.md
- [x] Tasks T-052..T-057 created as todo
- [x] `pnpm spec:check`, `pnpm tasks:check`, `pnpm verify:quick` green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Any code, test or config change (done by T-052..T-057).

## Handoff log

<!-- Append-only. -->

## Result

Spec clarifications applied (see PR body for the questions); ADR 0013 proposed; new tasks: T-052 (HIST-15 422), T-053 (available field), T-054 (form replace offer + archived source), T-055 (e2e overrun on edit), T-056 (docker hardening + smoke:compose), T-057 (e2e lock in globalSetup).
