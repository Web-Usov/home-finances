---
id: T-023
title: "Months: recalculate on month creation and draft promotion"
status: in_progress          # todo | in_progress | review | done | blocked
epic: E-01            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: api             # api | mobile | infra | docs
size: S               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-023-months-recalculate-on-month-creation          # set when work starts, e.g. task/T-000-slug
pr: null              # PR URL once opened
---

# T-023. Months: recalculate on month creation and draft promotion

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

`POST /months` writes the new month's `EnvelopeMonthSnapshot` rows in the same transaction, so a freshly created month
shows carried opening balances and copied allocations as replenished on `GET /dashboard/monthly`.

## Context

- Defect found in the PR #14 review: `MonthsService.create` (`apps/api/src/modules/months/months.service.ts`) copied
  allocations but never ran the cascade; the dashboard showed opening 0 / replenished 0 with non-zero allocated.
- Rules: FIN-04 (closing carries into next opening), DATA-06 (snapshots are the dashboard source), API-15.
- ADR 0004 (engine receives the external tx), ADR 0005 (the cascade bumps `version` of the recalculated months; the new
  month goes 1 -> 2 and the response re-reads it, so client and DB agree; no other client can hold its version yet).
- `close()` promoting a draft only changes status; snapshots do not depend on status and the draft was recalculated at
  creation, so no recalculation is needed there (covered by a test).

## Definition of Done

- [x] Month creation runs `engine.recalculateMonthAtomically(monthId, tx)` in the same transaction as the insert and allocation copy
- [x] Unit test with a distinct tx object asserts the engine is called with tx, after the copy (`FIN-04 / DATA-06 / API-15`)
- [x] Int test: month 2 dashboard shows carried openings and copied allocations as replenished (`FIN-04 / DATA-06`)
- [x] Int test: draft promoted on close has a consistent dashboard (`MON-08 / FIN-04 / DATA-06`)
- [x] Int test: first month (no previous) still works; response version equals DB version (ADR 0005)
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Things that belong to other tasks.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Fixed in `months.service.ts` `create`: after the insert and allocation copy, the engine recalculates the new month with
the same tx and the summary is re-read (version 2 after the bump, ADR 0005). `close()` needed no code change: tests prove
the promoted draft's dashboard is identical before and after promotion. Tests: `months.service.spec.ts` (tx identity,
rollback on engine failure), `months.create-recalc.int-spec.ts` (4 cases; the carry cases fail without the fix).
Deviation: new months now report `version: 2` instead of 1 on creation.
