---
id: T-036
title: "Lock month row in every month-scoped mutation (optimistic lock race)"
status: done          # todo | in_progress | review | done | blocked
epic: E-00            # epics/E-xx-*.md
depends: []           # [T-001, T-002] - must be done before this task starts
blocked_by: []        # [Q-01] - open questions from docs/spec/99-open-questions.md
spec: []              # rule IDs this task implements, e.g. [OP-05, MON-08]
acceptance: []        # AC ids this task contributes to, e.g. [AC-06]
area: api             # api | mobile | infra | docs
size: M               # S | M  (one agent session, ~300-500 LOC max)
branch: task/T-036-lock-month-row-in-every-month-scoped          # set when work starts, e.g. task/T-000-slug
pr: https://github.com/Web-Usov/home-finances/pull/25              # PR URL once opened
---

# T-036. Lock month row in every month-scoped mutation (optimistic lock race)

<!--
Format rules (checked by `node scripts/tasks.mjs check`):
- File name: `T-NNN-slug.md`, id equals the file prefix, ids are numeric and sequential.
- Frontmatter is flat: scalars, inline lists `[a, b]`, `null`. Keep one key per line.
- status `in_progress`/`review` requires `branch`; `done` requires `pr`, no unchecked `- [ ]` in Definition of Done and a non-empty Result (HTML comments ignored). `review` is optional.
- `pnpm task:start T-000` claims the task (worktree, branch, in_progress); change status otherwise with `node scripts/tasks.mjs set T-000 <status>`.
- A task is a vertical slice (API + tests, or one UI screen + tests + e2e) that fits one agent session.
-->

## Goal

Every month-scoped mutation locks the month row `FOR UPDATE` and checks existence, `version` and status under the lock, in
one shared helper, so two writers with the same `version` can no longer both succeed (DATA-12) and nothing is written
into a month that is closing (MON-03).

## Context

- Defect reproduced in the review of PR #22 (finding 1): `close` + `PUT allocations` + `POST envelopes {initialBalance}` fired
  concurrently with the same `version` gave 200/200/201 in 1 of 40 rounds. Only `OperationsService.lockMonth` locked the row.
- Supersedes/extends T-029 from the pending spec PR #12 (`allocations.save` version check inside the transaction): the planner
  reconciles. T-028 (DB-level constraint for MON-13) is still open; here MON-13 is checked under the lock.
- Spec: DATA-12, MON-03, MON-13, CALC-13. ADRs 0004, 0005. Files: `apps/api/src/common/month-lock.ts`, the months,
  allocations, envelopes and operations services.
- Lock order: target month and all later months, ascending period, in ONE `ORDER BY period FOR UPDATE` statement (the cascade
  bumps `version` of all of them). Create: advisory lock + all months ascending. Working-month mutations: resolve, lock,
  re-resolve under the lock.

## Definition of Done

- [x] `lockMonthForMutation` / `lockWorkingMonth` / `lockAllMonths` in `common/month-lock.ts`, unit-tested with a distinct tx (`month-lock.spec.ts`): order existence → version → status
- [x] Used by operations (replaces its private `lockMonth`), allocations.save, envelopes create/archive, months create/updateIncome/close/reopen
- [x] `it('DATA-12 / MON-03 / CALC-13: close vs ...')` races pass: exactly one 2xx, losers 409, no 5xx, state equals answers (`month-lock.concurrency.close-vs-mutation.int-spec.ts`)
- [x] Same-kind races, MON-13 reopen race, unique-name and first-month races pass (`month-lock.concurrency.same-kind.int-spec.ts`)
- [x] The new race tests fail against the previous services (checked)
- [x] AC-14 test uses concurrent requests on the listened harness; misleading comment removed
- [x] `pnpm verify` is green
- [x] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [x] Mutations still bump the BudgetMonth `version` (existing int tests unchanged)
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- A DB-level constraint for MON-13 (T-028), spec/ADR edits, changes in `apps/mobile`.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Shared helper `apps/api/src/common/month-lock.ts`; all month-scoped mutations lock the month row inside their transaction.

- Lock order (single global order, ascending period): target month + all later months in one `ORDER BY period FOR UPDATE`.
  close = month then draft; reopen = target then later months (MON-13 is checked under that lock: the reopened month either lies
  in the range or its close shares a locked row); create = advisory lock + all months; operations create / envelope create / archive
  = `lockWorkingMonth` (resolve, lock, re-resolve; an earlier working month after the lock gives 409 VERSION_CONFLICT instead of
  an out-of-order lock).
- Also fixed on the way: concurrent envelope creates with one name (and a rename) ended in a Prisma unique violation = 500, now
  409 ENVELOPE_NAME_DUPLICATE; concurrent creates of one month = unique violation, now 422/409.
- Race tests (real concurrency on `t.listen()`): 15 rounds x 14 races (close vs allocations, income, expense, edit/delete operation,
  envelope create with a balance, archive, next month; same-kind pairs; MON-13 reopen pair; same-name envelope with and without a
  month; same first month). Against the previous services 7 of 8 `close vs ...` races fail in the first rounds (200/200).
- Deviation: ROUNDS is 15 (not 20) to keep the two files at ~45 s wall time on a loaded machine; the AC-14 test is concurrent again.
- Follow-up for the planner: T-029 (allocations version-in-tx) is covered here; T-028 (DB constraint for MON-13) stays useful as defence in depth.