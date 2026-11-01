<!-- Agent-only PRs (auto-merged after review) use this English template. PRs that need human review (docs/spec/**, docs/decisions/**, epics/**, milestone reports) use .github/PULL_REQUEST_TEMPLATE/human-review.md instead: Russian body starting with "⚠️ Требуется ревью человека". -->

## Task

Task: [T-xxx](../blob/master/tasks/T-xxx-slug.md)
Epic: E-xx
Spec rules: <!-- rule IDs only, e.g. OP-05, AC-06 -->

## What changed

<!-- Short summary of the change, by behavior rather than by file. -->

## How verified

<!-- Commands run, named tests (e.g. `it('OP-05 / AC-06: ...')`), e2e specs and screenshot artifacts (link to the Playwright report). -->

- [ ] `pnpm verify`
- [ ] e2e (UI tasks): `pnpm e2e:smoke` / named spec:

## Checklist

- [ ] `pnpm verify` is green
- [ ] Tests cite rule IDs in their names (`node scripts/spec-check.mjs` passes)
- [ ] Task file updated: DoD ticked, Result filled, and the final commit sets `status: done` + `pr: <this PR>` with the board regenerated (`pnpm tasks:check` passes)
- [ ] No edits to `docs/spec/**`, `docs/decisions/**` or `epics/**` without human review
