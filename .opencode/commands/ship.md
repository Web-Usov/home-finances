---
description: Preflight, push, open the PR from the template, mark the task done; never merges
---

Ship the current task branch. Follow `docs/workflow.md` sections 5-6. You never enable auto-merge or merge: the
reviewer does that after `VERDICT: LGTM`.

Branch and status: !`git branch --show-current && git status --short | head -20`

1. Preflight - stop and report on the first failure:
   - On a task branch `task/T-xxx-slug`, not `master`; task file `tasks/T-xxx-*.md` exists.
   - `git fetch origin`; if behind `origin/master`, `git merge origin/master` (resolve `tasks/README.md` by running
     `pnpm tasks:board`). Never rebase-and-force-push.
   - `pnpm verify` is green (and `pnpm e2e:smoke` if the task `area` is mobile or it has e2e DoD items).
   - Every Definition of Done item is satisfied and ticked; `## Result` is filled.
   - Protected paths: `git diff origin/master --name-only | grep -E '^(docs/spec|docs/decisions|epics)/'`. An implementation
     task must have none (stop and report).
   - Task status is `review`: `node scripts/tasks.mjs set T-xxx review --branch <branch>`, `pnpm tasks:board`, `pnpm tasks:check`.
2. Commit anything left (`type(scope): subject [T-xxx]`), then `git push -u origin <branch>`.
3. Build the PR body from `.github/pull_request_template.md` (task link, epic, spec rule IDs, what changed, how verified
   with the exact commands and named tests, checklist ticked) and run
   `gh pr create --title "type(scope): subject [T-xxx]" --body-file <file>`. Title format is the squash commit subject.
4. Done status: with the PR URL run `node scripts/tasks.mjs set T-xxx done --pr <url>`, `pnpm tasks:board`,
   `pnpm tasks:check`, commit `docs(tasks): mark T-xxx done [T-xxx]`, push.
5. Do NOT run `gh pr merge`. Print the PR URL and tell the user/orchestrator to run `/review <pr>`. On LGTM the
   reviewer enables auto-merge (not for PRs touching `docs/spec/**`, `docs/decisions/**`, `epics/**`: the human merges
   those). On CHANGES REQUESTED fix the findings, set the task back to `review` if needed, push, and ask for `/review` again.
6. After the merge (when the user confirms) clean up the worktree as described in `docs/workflow.md` section 2.
