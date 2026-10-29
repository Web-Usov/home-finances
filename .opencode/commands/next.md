---
description: Show ready tasks, or start task T-xxx (branch, worktree, in_progress)
---

Follow `docs/workflow.md` sections 1-2.

Ready tasks right now (`pnpm tasks:next`):

!`pnpm tasks:next 2>&1 || true`

Argument: "$ARGUMENTS"

- If the argument is empty: list the ready tasks above with one line each (id, title, area, size, spec rules), check
  `gh pr list` and `git branch -r` for tasks already in flight on the same module, and recommend ONE task with a short
  reason. Do not start it.
- If the argument is a task id (`T-xxx`): verify it is in the ready list (otherwise explain what blocks it and stop). Then:
  1. Run `pnpm task:start T-xxx` from the main checkout. It validates the task (todo, depends done, not blocked), fetches,
     creates `../finance-wt/t-xxx-<slug>` on `task/T-xxx-<slug>` from `origin/master`, copies `apps/api/.env` and
     `apps/api/.env.test` (from `.env.test.example` if the main checkout has none), runs `pnpm install --frozen-lockfile`,
     sets `in_progress` + branch, regenerates the board and makes the claim commit `chore(tasks): start T-xxx [T-xxx]`.
     If it fails, report the message and stop.
  2. Print the full task file, the spec rule IDs it cites, and the absolute worktree path printed by the script
     (the implementer must run its tools from that directory).
