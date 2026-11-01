---
id: T-049
title: "Language rule: Russian for everything the human reviews or decides"
status: in_progress          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: docs             # api | mobile | infra | docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-049-language-rule-russian-for-everything          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-049. Language rule: Russian for everything the human reviews or decides

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

Make the owner's language decision (2026-11-01) concrete and enforced in the process: everything a human reviews or
decides is written in Russian; agent-only artifacts stay English.

## Context

- ADR 0010 (language of artifacts), ADR 0009 (process). Files: `AGENTS.md`, `docs/workflow.md`,
  `.github/PULL_REQUEST_TEMPLATE/human-review.md`, `.opencode/agents/{planner,reviewer,implementer}.md`,
  `.opencode/commands/{ship,review,milestone}.md`.

## Definition of Done

Every item must be verifiable by a command or a named test.

- [x] AGENTS.md "Language rule" lists what is Russian (human review/decision) and what stays English
- [x] docs/workflow.md applies the rule in ship, review, blocked/escalation, milestones and has a Russian "question to the human" template
- [x] Human-review PR template exists and `/ship` uses it for PRs that need human review
- [x] Agent prompts and commands (planner, reviewer, implementer, ship, review, milestone) carry the rule
- [x] ADR 0010 has a dated Russian addendum
- [x] `pnpm spec:check`, `pnpm tasks:check`, `pnpm verify:quick` are green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Translating existing agent-facing docs or changing the code/commit language.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Language rule made concrete (AGENTS.md, workflow.md, ADR 0010 addendum, human-review PR template, agent prompts and commands). Chose a separate template file `.github/PULL_REQUEST_TEMPLATE/human-review.md` (used by `/ship` via `--body-file`). PR titles stay English. No deviations.