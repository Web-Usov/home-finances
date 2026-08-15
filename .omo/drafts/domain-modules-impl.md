# domain-modules-impl — Draft

## Intent
- **intent**: clear
- **review_required**: false
- **classification**: Architecture (6 modules, cross-cutting calculation engine, full stack backend + frontend)

## Owner decisions recorded

### 1. Implementation order
- **Decision**: Calculation Engine first (core-first approach)
- **Rationale**: All other modules depend on it; building it first prevents refactoring later
- **Alternative considered**: Outside-in (Envelopes first), rejected because it would require mock engine

### 2. Frontend parallelism
- **Decision**: Parallel frontend for each module via subagents
- **Rationale**: Immediate visual feedback; aligns with user's preference
- **Scope**: For each backend module, a matching frontend screen is implemented immediately

### 3. Test coverage
- **Decision**: Module tests for Calculation Engine + Integration tests for API endpoints
- **Rationale**: SPECIFICATION.md § Testing (lines 525-535) requires engine unit tests; integration tests cover status transitions and cascade recalculation
- **Not included**: E2E browser tests (out of scope per user choice)
- **Strategy**: tests-after for engine (complex formulas need implementation before tests); TDD for simple CRUD modules

## Components ledger

| ID | Component | Outcome | Status | Evidence |
|----|-----------|---------|--------|----------|
| C1 | Calculation Engine | Deterministic cascade recalculation service with full test coverage | Planned | `apps/api/src/modules/calculation-engine/` |
| C2 | Envelopes | CRUD + archive with zero-balance validation | Planned | `apps/api/src/modules/envelopes/` |
| C3 | Months | Lifecycle (create, income, close, reopen) with status transitions | Planned | `apps/api/src/modules/months/` |
| C4 | Allocations | PUT allocation table with income validation | Planned | `apps/api/src/modules/allocations/` |
| C5 | Operations | Expense/transfer/adjustment with sequence_no stability | Planned | `apps/api/src/modules/operations/` |
| C6 | Reporting | Dashboard + yearly analytics reading snapshots | Planned | `apps/api/src/modules/reporting/` |
| C7 | Frontend Integration | Orval-generated clients + screens for all modules | Planned | `apps/mobile/` |

## Status
- **status**: awaiting-approval
- **approach**: Core-first implementation: Calculation Engine → Envelopes → Months → Allocations → Operations → Reporting; parallel frontend via subagents; module tests for engine + integration tests for API
- **next_action**: Generate `.omo/plans/domain-modules-impl.md` after explicit user approval

## Risk register
- **RISK-1**: Calculation Engine complexity — cascade recalculation across 240 months/100k ops must complete under 5s
- **RISK-2**: Prisma transaction boundaries — all mutations must be atomic (source + recalculation)
- **RISK-3**: Frontend subagent coordination — parallel frontend work may drift from evolving API contracts
- **RISK-4**: Money arithmetic — Int kopecks must never overflow or underflow

## Pending questions
- None (all owner decisions resolved through interview)
