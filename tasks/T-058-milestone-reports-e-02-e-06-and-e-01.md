---
id: T-058
title: "Milestone reports E-02..E-06 and E-01 addendum"
status: review          # todo | in_progress | review | done | blocked
epic: E-06            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: docs             # api | mobile | infra | docs
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-058-milestone-reports-e-02-e-06-and-e-01          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-058. Milestone reports E-02..E-06 and E-01 addendum

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

Russian milestone reports for E-02..E-06 (with e2e screenshots and compose smoke output), a post-acceptance addendum to the E-01 report, and a milestones overview; epics E-02..E-06 become `done`.

## Context

- Command `.opencode/commands/milestone.md`, `docs/workflow.md` section 8, format reference `docs/milestones/E-01-report.md`.
- Outputs: `docs/milestones/E-0{2..6}-report.md`, `docs/milestones/img/E-0{3..6}/*.png`, `docs/milestones/README.md`, `epics/E-0{2..6}-*.md` (`status: done`).

## Definition of Done

- [x] `pnpm spec:check --verbose` coverage of every epic rule listed honestly in each report
- [x] `pnpm e2e:full` green (24 passed) and `pnpm smoke:compose` passed, outputs summarised in the reports
- [x] `pnpm tasks:check` and `pnpm spec:check` pass
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Setting `accepted` (only the human does); code, tests and configs.

## Handoff log

## Result

Reports E-02..E-06 and the E-01 addendum are written; screenshots (about 0.6 MB in total) are in `docs/milestones/img/`. E-01 keeps `status: accepted` (the human decision is not reverted); its addendum awaits confirmation. Findings: rules without test references (UI-01, UI-15, HIST-01..04, UI-04, DOD-01/03/04/05/06, NFR-27, NFR-29) and no migration test on a populated DB (NFR-29).
