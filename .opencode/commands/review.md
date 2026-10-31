---
description: Review a PR (number) or a task (T-xxx) with the read-only reviewer agent
agent: reviewer
subagent: true
---

Review this target: $ARGUMENTS

If it is a task id `T-xxx`, find its PR with `gh pr list --state open --search "T-xxx" --json number,title,headRefName`
(or use the `pr` field of the task file). If no PR exists, say so and stop.
Follow your checklist, post the verdict as a PR comment: write the body to a temp file under `/tmp` and run
`gh pr review <n> --comment --body-file <file>` (no `--approve` attempt: self-approval is impossible with a single GitHub
account; if writing temp files is not permitted use `gh pr comment <n> --body "..."`). Read PR files without a worktree via
`git fetch origin <head>` + `git show origin/<head>:<path>`. Return the verdict block (`VERDICT: LGTM | CHANGES REQUESTED`,
findings with file:line, checks) as your final answer. On LGTM, if the diff touches no `docs/spec/**`, `docs/decisions/**`,
`epics/**`, first, if `gh pr view <n> --json mergeStateStatus` is `BEHIND`, run `gh pr update-branch <n>` (merge only, never `--rebase`; if GitHub reports a conflict, return the PR to the author instead: author merges master locally, runs `pnpm tasks:board`, re-verifies; otherwise CI re-runs on the updated head and detects stale generated files/board), then enable auto-merge with `gh pr merge <n> --squash --auto`, then check
`gh pr view <n> --json state,autoMergeRequest` and report "merged" (state MERGED) or "auto-merge enabled"
(autoMergeRequest set); otherwise state that the PR waits for the human. On CHANGES REQUESTED do not enable
auto-merge (safety: `gh pr merge <n> --disable-auto`).
