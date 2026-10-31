# packages/types — shared domain types

`@family-budget/types`: Zod schemas, TS entities, `ApiErrorCode` and money helpers. Single source of truth for the domain
model; used by both `apps/api` and `apps/mobile`. Global rules are in the root `AGENTS.md`.

## Layout

```
src/
  entities.ts   TS interfaces (BudgetMonth, Envelope, Operation, ...) and the ApiErrorCode union
  schemas.ts    Zod schemas, request DTO schemas, PeriodSchema, parseMoneyMinor / formatMoneyMinor, validators
  index.ts      re-exports
```

## Where to look

| Task | Where |
| --- | --- |
| Add an entity | interface in `entities.ts` + Zod schema in `schemas.ts` |
| Add API request validation | `schemas.ts`, naming `Create*RequestSchema` / `Update*RequestSchema` |
| Convert money | `parseMoneyMinor("15000.00")` → `1500000`; `formatMoneyMinor(1500000)` → `"15000.00"` |
| Amount inside a server message | `formatMoneyMinorRu(123450)` → `"1\u00A0234,50"` (MSG-07; transport fields keep `formatMoneyMinor`) |
| Add an error code | extend the `ApiErrorCode` union in `entities.ts` |

## Conventions

- Interfaces PascalCase; schemas PascalCase + `Schema` suffix; enums as TS unions + Zod `.enum()`.
- Money fields are named `*Minor` and are always integer `number`. Periods are `YYYY-MM` validated by `PeriodSchema`.
- File headers and comments cite spec rules by ID (e.g. `DATA-08`), never by line number.

## Anti-patterns

- Float money; business logic or I/O in this package; importing from `apps/*`.

## Commands

```bash
cd packages/types
pnpm build       # tsc → dist/
pnpm typecheck
```
