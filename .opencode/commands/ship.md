---
description: Preflight, push, open the PR from the template, mark the task done; never merges
---

Ship the current task branch. Follow `docs/workflow.md` sections 5-6. You never enable auto-merge or merge: the
reviewer does that after `VERDICT: LGTM`.

Branch and status: !`git branch --show-current && git status --short | head -20`

1. Preflight - stop and report on the first failure:
   - On a task branch `task/T-xxx-slug`, not `master`; task file `tasks/T-xxx-*.md` exists.
   - Merge `origin/master` right before shipping (branch protection is strict: a PR behind master cannot merge until updated).
   - `git fetch origin`; if behind `origin/master`, `git merge origin/master` (resolve `tasks/README.md` by running
     `pnpm tasks:board`). Never rebase-and-force-push.
   - `pnpm verify` is green (and `pnpm e2e:smoke` if the task `area` is mobile or it has e2e DoD items).
   - Every Definition of Done item is satisfied and ticked (`- [x]`); `## Result` is filled (the task check enforces both for `done`).
   - Protected paths: `git diff origin/master --name-only | grep -E '^(docs/spec|docs/decisions|epics)/'`. An implementation
     task must have none (stop and report).
2. Commit anything left (`type(scope): subject [T-xxx]`; stage everything, pre-commit checks the working tree), then
   `git push -u origin <branch>`.
3. Build the PR body from `.github/pull_request_template.md` (task link, epic, spec rule IDs, what changed, how verified
   with the exact commands and named tests, checklist ticked) and run
   `gh pr create --title "type(scope): subject [T-xxx]" --body-file <file>`. Title format is the squash commit subject
   (header at most 100 chars).
4. Done status, ONE commit (there is no separate `review` commit; the `review` status is optional and not used here):
   with the PR URL run `node scripts/tasks.mjs set T-xxx done --pr <url>`, `pnpm tasks:board`, `pnpm tasks:check`,
   commit `docs(tasks): mark T-xxx done [T-xxx]`, `git push`.
5. Wait for CI: sleep ~30s after the push (checks are not registered immediately), then
   `gh pr checks <n> --watch` (if it reports no checks yet, sleep 15s and retry until they appear). Report the result.
6. Do NOT run `gh pr merge`. Print the PR URL and tell the user/orchestrator to run `/review <pr>`. On LGTM the
   reviewer enables auto-merge (not for PRs touching `docs/spec/**`, `docs/decisions/**`, `epics/**`: the human merges
   those). On CHANGES REQUESTED fix the findings, push, and ask for `/review` again (a new commit after the `done` commit
   is fine; `done` stays, it only lands on `master` with the squash merge).
7. After the merge (when the user confirms) run `pnpm task:clean T-xxx` from the main checkout.
