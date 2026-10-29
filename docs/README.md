# Documentation

| Document | Language | Purpose |
| --- | --- | --- |
| [spec/README.md](spec/README.md) | RU | Normative product specification split into files with stable rule IDs (`OP-04`, `AC-06`) |
| [decisions/README.md](decisions/README.md) | RU | Architecture decision records (ADR) with index |
| [architecture.md](architecture.md) | EN | Modules, request and recalculation flow, error model, client, data model |
| [testing.md](testing.md) | EN | Testing strategy, commands, test database, e2e, API contract, compose smoke |
| [workflow.md](workflow.md) | EN | Task lifecycle: pick, worktree, implement, ship, review, handoff, milestones; OpenCode agents and commands |
| [archive/](archive/) | mixed | History only: original monolithic `SPECIFICATION.md` and archived `omo` plans/evidence. Line numbers in them are obsolete. |

Related: root [AGENTS.md](../AGENTS.md) (agent entry point), `tasks/` and `epics/` (work items; board in `tasks/README.md`),
`scripts/spec-check.mjs` (checks spec rule IDs and their references).

Language policy: see ADR 0010 — Russian for epics, spec and ADRs; English for everything agents read or write.
