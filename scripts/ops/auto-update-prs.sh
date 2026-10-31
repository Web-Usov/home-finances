#!/usr/bin/env bash
# Keeps PRs with auto-merge enabled current with master (T-047).
# Branch protection is strict, so a PR whose auto-merge is armed goes BEHIND when another PR merges first and then stalls:
# GitHub does not update the branch itself, and a GITHUB_TOKEN workflow could not do it either (its pushes do not trigger CI).
# This script runs on the host (timer, scripts/ops/systemd) with the owner's `gh` auth and calls the update-branch REST
# endpoint (merge method only, never rebase). Idempotent: does nothing when no PR needs an update.
# Env: REPO (owner/name; default derived from `gh repo view`), DRY_RUN=1 (log only, no API call).
set -euo pipefail

# `gh repo view` needs a git checkout as cwd; systemd starts the unit elsewhere.
cd "$(dirname "$0")"

log() { echo "auto-update-prs: $*"; }

repo=${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}
prs=$(gh pr list --repo "$repo" --state open --limit 100 --json number,autoMergeRequest,mergeStateStatus,isDraft,headRefName)

updated=0
while IFS=$'\t' read -r number state head; do
  [ -n "$number" ] || continue
  case "$state" in
    BEHIND)
      if [ "${DRY_RUN:-}" = 1 ]; then
        log "#$number ($head) is BEHIND: would update-branch (dry run)"
        continue
      fi
      if gh api -X PUT "repos/$repo/pulls/$number/update-branch" >/dev/null; then
        log "#$number ($head) was BEHIND: update-branch requested"
        updated=$((updated + 1))
      else
        log "#$number ($head) was BEHIND: update-branch FAILED" >&2
      fi
      ;;
    DIRTY) log "#$number ($head) has merge conflicts: skipped, the author must resolve them" ;;
  esac
done < <(jq -r '.[] | select(.autoMergeRequest != null and (.isDraft | not)) | [.number, .mergeStateStatus, .headRefName] | @tsv' <<<"$prs")

[ "$updated" -gt 0 ] || log "nothing to update"
