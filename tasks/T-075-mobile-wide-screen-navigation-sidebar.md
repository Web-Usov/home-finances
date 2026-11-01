---
id: T-075
title: "Mobile: wide-screen navigation (sidebar) — UI-01"
status: done          # todo | in_progress | review | done | blocked
epic: E-03            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: [UI-01]              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: mobile             # api | mobile | infra | docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-075-mobile-wide-screen-navigation-sidebar          # set when work starts, e.g. task/T-000-slug
pr: https://github.com/Web-Usov/home-finances/pull/66              # PR URL once opened
---

# T-075. Mobile: wide-screen navigation (sidebar) — UI-01

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

From 768 px the bottom tab bar was hidden and nothing replaced it. Show a left sidebar with the four sections (active state, roles/labels, keyboard focusable) on wide screens; phones keep the bottom tab bar.

## Context

- `apps/mobile/app/(tabs)/_layout.tsx`, new `src/components/navigation/*`. Rule UI-01. Found in T-073.

## Definition of Done

- [x] `UI-01` component tests (`AppShell.test.tsx`) pass: sidebar from 768 px, none below
- [x] Playwright `@smoke` at 1280x800: sidebar visible, all four sections reachable; existing 390 px tab-bar test unchanged
- [x] `pnpm verify` is green and `pnpm e2e:smoke` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Restyling (epic E-07).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Added `AppShell` + `SideNav` (expo-router `Link`, `role=navigation`, `aria-current` on the active link) around the tab navigator; Envelopes screen got the same `max-w-3xl` content width as the other screens. No deferred-list entry for UI-01 existed on master, nothing to remove.