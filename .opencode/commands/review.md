---
description: Review a PR (number) or a task (T-xxx) with the read-only reviewer agent
agent: reviewer
subagent: true
---

Review this target: $ARGUMENTS

If it is a task id `T-xxx`, find its PR with `gh pr list --state open --search "T-xxx" --json number,title,headRefName`
(or use the `pr` field of the task file). If no PR exists, say so and stop.
Follow your checklist, post the verdict as a PR comment (`gh pr review --comment`; self-approval is impossible with a
single GitHub account) and return the verdict block (`VERDICT: LGTM | CHANGES REQUESTED`, findings with file:line,
checks) as your final answer. On CHANGES REQUESTED also disable auto-merge: `gh pr merge <n> --disable-auto`.
