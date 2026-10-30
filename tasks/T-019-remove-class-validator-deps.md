---
id: T-019
title: Remove unused class-validator and class-transformer dependencies
status: in_progress
epic: E-00
depends: []
blocked_by: []
spec: []
acceptance: []
area: api
size: S
branch: task/T-019-remove-class-validator-deps
pr: null
---

# T-019. Remove unused class-validator and class-transformer dependencies

## Goal

`class-validator` and `class-transformer` are no longer dependencies of `apps/api` (ADR 0003: validation is Zod only).

## Context

- Found in the T-001 review: after the legacy global `ValidationPipe` was dropped nothing imports them, but `apps/api/package.json` still lists them.
- `apps/api/AGENTS.md` and root `AGENTS.md` mention class-validator only as an anti-pattern; keep those mentions.
- When removing a global pipe/filter/interceptor, also grep for the decorators/DTOs it acted on (`@IsString`, `@Type`, ...).

## Definition of Done

- [ ] `grep -rn "class-validator\|class-transformer" apps packages e2e --include=*.ts --include=*.tsx --include=*.json` (excluding `node_modules`) returns nothing
- [ ] `pnpm-lock.yaml` updated with `pnpm install` (no manual edits); `pnpm install --frozen-lockfile` passes
- [ ] `pnpm api:contract` shows no drift in `openapi.json` and the mobile client
- [ ] `pnpm verify` is green
- [ ] Task file updated (status, branch, pr, Result)

## Out of scope

- Removing other dependencies, or changing validation behavior.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

<!-- Filled at the end: PR link, notes, deviations. -->
