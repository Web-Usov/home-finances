---
id: T-001
title: ZodValidationPipe returns 422 and drop legacy global ValidationPipe
status: done
epic: E-00
depends: []
blocked_by: []
spec: [API-17]
acceptance: []
area: api
size: S
branch: task/T-001-zod-pipe-422
pr: https://github.com/Web-Usov/home-finances/pull/3
---

# T-001. ZodValidationPipe returns 422 and drop legacy global ValidationPipe

## Goal

Validation errors from `ZodValidationPipe` are HTTP 422 per API-17, in the same `{ error, message }` envelope as domain errors; the leftover class-validator global pipe is removed.

## Context

- `apps/api/src/common/pipes/zod-validation.pipe.ts` currently throws Nest `BadRequestException` (400).
- `apps/api/src/main.ts` registers a global class-validator `ValidationPipe` (contradicts ADR 0003).
- `apps/api/src/common/exceptions/validation.exception.ts` and `DomainExceptionFilter` already render 422.
- Spec: API-17. ADR 0003. See "Gap" notes in `docs/architecture.md` section 3.
- Check whether existing envelopes/allocations integration tests assert 400 and update them to 422.

## Definition of Done

- [x] `ZodValidationPipe` throws the domain `ValidationException` (422) with a message listing field paths; response shape is `{ error, message }`
- [x] `app.useGlobalPipes(new ValidationPipe(...))` and the `class-validator`/`class-transformer` imports are removed from `main.ts` (`grep -n ValidationPipe apps/api/src/main.ts` finds nothing)
- [x] Unit test `it('API-17: invalid body yields 422 ValidationException')` for the pipe
- [x] Integration test `it('API-17: POST /envelopes with empty name returns 422')`
- [x] `docs/architecture.md` section 3 "Gap" bullets about 400/global pipe are removed or updated
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Changing other controllers to use the pipe (done in each feature task).
- Removing the class-validator dependency from package.json (tooling owner).

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

- `ZodValidationPipe` now throws `ValidationException('VALIDATION_ERROR', "<path>: <msg>; ...")` -> 422 `{ error, message }`.
  Added `VALIDATION_ERROR` to `ApiErrorCode` (`packages/types`); it was not listed in API-18, so the planner may want to add it to the spec.
- Deviation: the legacy global `ValidationPipe` lived in `apps/api/src/app.setup.ts` (`configureApp`), not `main.ts`; removed there
  (`grep -rn ValidationPipe apps/api/src` finds only `ZodValidationPipe`). `envelopes.http.spec.ts` now uses `configureApp` instead of its own copy of the setup.
- Tests: `zod-validation.pipe.spec.ts` (unit), `envelopes.int-spec.ts` (real test DB, `configureApp`). No existing test asserted 400.
- `docs/architecture.md` section 3: 400 gap removed, global-pipe gap updated.
- Follow-ups: remove `class-validator`/`class-transformer` from package.json (explicitly out of scope).
