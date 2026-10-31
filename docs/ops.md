# Host ops: auto-update of BEHIND PRs

Language: English. Task: T-047. Preview deployment has its own doc: `docs/preview.md`.

## Why

`master` has strict required checks (`verify`, `contract`, `e2e`): a PR must be up to date to merge. When PR A merges while the CI of
PR B (auto-merge enabled) is running, B becomes `BEHIND` and its auto-merge stalls, because GitHub does not update the branch itself.
A GitHub Action cannot fix this: commits pushed with `GITHUB_TOKEN` do not trigger CI. So a host timer does it with the owner's
`gh` auth.

## What it does

`scripts/ops/auto-update-prs.sh`, every 2 minutes (`family-budget-auto-update-prs.timer`):

- lists open PRs; for each one that is not a draft, has auto-merge enabled and `mergeStateStatus == BEHIND` it calls
  `gh api -X PUT repos/<owner/repo>/pulls/<n>/update-branch` (merge method only, never rebase). GitHub merges master in and re-runs CI.
- `DIRTY` (conflicts) is only logged: the author must merge `origin/master` locally and resolve.
- Everything else (CLEAN, BLOCKED, no auto-merge, draft) is ignored. Idempotent; no-op when nothing needs an update.
- The repo slug comes from `gh repo view` (override with `REPO=owner/name`); `DRY_RUN=1` logs without calling the API.

Reviewers still run update-branch by hand on LGTM (`docs/workflow.md`, section 6); the timer covers the time after that.

## Install, status, logs

The unit runs as **root** because the `gh` auth lives in `/root/.config/gh`. Hardening is minimal (`NoNewPrivileges`, `PrivateTmp`,
`ProtectSystem=strict`, kernel/cgroup protections); no `ProtectHome`, since `gh` needs `/root`. The units point at the checkout
the installer is run from, so install from the main checkout on master.

```bash
scripts/ops/install-systemd.sh                       # as root, idempotent: renders units, enables the timer
systemctl list-timers family-budget-auto-update-prs.timer
systemctl status family-budget-auto-update-prs.timer family-budget-auto-update-prs.service
journalctl -u family-budget-auto-update-prs -n 50    # one line per action
systemctl start family-budget-auto-update-prs        # run now
DRY_RUN=1 scripts/ops/auto-update-prs.sh             # what would happen, no API calls
systemctl disable --now family-budget-auto-update-prs.timer   # pause
```

Remove: disable as above, delete `/etc/systemd/system/family-budget-auto-update-prs.*`, `systemctl daemon-reload`.
