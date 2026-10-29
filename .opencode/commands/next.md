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
  1. `git fetch origin`; derive `<slug>` from the task file name `tasks/T-xxx-<slug>.md`.
  2. `git worktree add ../finance-wt/t-xxx-<slug> -b task/T-xxx-<slug> origin/master`.
  3. In the new worktree: `pnpm install`, copy `apps/api/.env` and `apps/api/.env.test` from the main checkout if they exist.
  4. `node scripts/tasks.mjs set T-xxx in_progress --branch task/T-xxx-<slug>`, `pnpm tasks:board`, commit
     `chore(tasks): start T-xxx [T-xxx]`.
  5. Print the full task file, the spec rule IDs it cites, and the worktree path where the work must continue
     (the implementer must run its tools from that directory).
