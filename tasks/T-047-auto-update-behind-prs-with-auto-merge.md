---
id: T-047
title: "Auto-update BEHIND PRs with auto-merge (host timer)"
status: done          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: infra             # api | mobile | infra | docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-047-auto-update-behind-prs-with-auto-merge          # set when work starts, e.g. task/T-000-slug
pr: https://github.com/Web-Usov/home-finances/pull/38              # PR URL once opened
---

# T-047. Auto-update BEHIND PRs with auto-merge (host timer)

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

Open PRs with auto-merge enabled that fall BEHIND master (strict branch protection) are updated automatically by a host timer, so they do not stall.

## Context

- `docs/workflow.md` section 6 (reviewer update-branch), `docs/preview.md` and `scripts/preview/*` (systemd style).
- A GitHub Action with `GITHUB_TOKEN` cannot do it: its pushes do not trigger CI. The host uses the owner's `gh` auth (root).

## Definition of Done

- [x] `scripts/ops/auto-update-prs.sh` updates BEHIND + auto-merge + non-draft PRs via update-branch (merge only), logs DIRTY, ignores the rest
- [x] `scripts/__tests__/auto-update-prs.test.mjs` (fake `gh`) passes
- [x] systemd service + timer (2 min) under `scripts/ops/systemd/`, installer `scripts/ops/install-systemd.sh`
- [x] `docs/workflow.md` and `docs/ops.md` updated
- [x] Installed on the host, run once, timer active
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Things that belong to other tasks.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Added `scripts/ops/` (script, units, installer), tests, `docs/ops.md`, workflow note. Installed on the host from the main checkout
after the merge (`scripts/ops/install-systemd.sh`); units reference the checkout they are installed from.