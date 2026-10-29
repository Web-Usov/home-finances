---
description: Save work in progress - WIP commit, push and Handoff log entry for the current task
---

Pause the current task safely so another session can continue. Follow `docs/workflow.md` section 4. Notes: $ARGUMENTS

1. Identify the task from the branch name (`git branch --show-current` -> `task/T-xxx-slug`) and its file `tasks/T-xxx-*.md`.
   If you are on `master` or the branch is not a task branch, stop and tell the user.
2. Append to `## Handoff log` of the task file (do not rewrite earlier entries):
   - date (`date -I`), session summary
   - Done: what works, which DoD items are ticked
   - Next: concrete next steps in order
   - State: branch, commit SHA after the WIP commit, failing tests/typecheck errors, uncommitted-looking gotchas
   - Q-proposal (question, options, recommendation) if blocked; in that case also run
     `node scripts/tasks.mjs set T-xxx blocked` and tell the user the task needs a decision.
3. `git add -A && git commit -m "wip(<scope>): <what is done> [T-xxx]"` (scope = module/area).
4. `git push -u origin <branch>`.
5. `git status --short` must be empty; print the branch, SHA and the Handoff entry.
