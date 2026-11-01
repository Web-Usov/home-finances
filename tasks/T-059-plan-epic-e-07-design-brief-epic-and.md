---
id: T-059
title: "Plan epic E-07 design: brief, epic and design tasks"
status: in_progress          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: docs             # api | mobile | infra | docs | design
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-059-plan-epic-e-07-design-brief-epic-and          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-059. Plan epic E-07 design: brief, epic and design tasks

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

Plan the design-only epic E-07: epic file, design brief, design tasks T-060..T-069, and the new `design` task area.

## Context

- Owner decision 2026-11-01: start a design-only epic; the design is created by the owner in a separate Doop MCP session; implementation is a later epic.
- Language rule: epic and brief are Russian, tasks English (`AGENTS.md`).

## Definition of Done

- [x] `epics/E-07-design.md` (RU): value, key results, scope, milestone acceptance criteria, out of scope.
- [x] `docs/design/README.md` (RU): brief with principles, anti-patterns and review checklist, platform limits, screen inventory, design kit, Doop process, handoff template, demo data.
- [x] Tasks T-060..T-069 (EN, epic E-07, area `design`) with owner-checkable DoD and chained `depends`.
- [x] `design` added to the area enum in `scripts/tasks.mjs`, `scripts/task-start.mjs`, `tasks/_template.md`; test in `scripts/__tests__/task-start.test.mjs`.
- [x] One-line pointers in `docs/README.md` and `AGENTS.md`.
- [x] `pnpm tasks:check`, `pnpm tasks:board`, `pnpm spec:check`, `pnpm test:scripts` pass.
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Any design work itself, markup or code.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Planning PR for E-07 (human review). Design tasks T-060..T-069 are `todo` and are executed by the owner in a separate Doop session.
