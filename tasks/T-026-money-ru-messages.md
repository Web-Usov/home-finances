---
id: T-026
title: ru-RU money formatting in server messages
status: done
epic: E-00
depends: [T-005, T-025, T-020]
blocked_by: []
spec: [MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, MSG-07, API-14, AC-03]
acceptance: [AC-03]
area: api
size: S
branch: task/T-026-money-ru-messages
pr: https://github.com/Web-Usov/home-finances/pull/32
---

# T-026. ru-RU money formatting in server messages

## Goal

Amounts inside server-generated `message` fields follow MSG-07 (`0,01`, `1 234,50`, NBSP thousands separator); API amount fields stay decimal strings (API-14).

## Context

- Spec: MSG-07. Today `formatMoneyMinor` (`packages/types/src/schemas.ts`) returns `"0.01"` and is used both for messages and as a transport format; add a separate helper (e.g. `formatMoneyRu(minor)`) in `packages/types`, keep `formatMoneyMinor` unchanged.
- Call sites in messages: `months.service.ts`, `allocations.service.ts`, `operations.service.ts`, `envelopes.service.ts` (grep `formatMoneyMinor` near `₽`). Negative values are not expected in messages.
- Chained after T-005/T-025 because it edits `operations.service.ts`.

## Definition of Done

- [x] `it('MSG-07: formats 1 kopeck, 123450 kopecks and 10000000 kopecks as 0,01 / 1 234,50 / 100 000,00')` (unit, with U+00A0 separator) passes
- [x] `it('MSG-01 / AC-03: overflow of 0.01 renders Распределено на 0,01 ₽ больше дохода. Уменьшите суммы по конвертам.')` passes
- [x] Tests for MSG-02, MSG-03, MSG-04, MSG-05 assert the ru-RU amounts in `message`
- [x] `pnpm api:generate` was run and `pnpm api:contract` shows no drift (only if controllers/DTOs/types changed)
- [x] `pnpm verify` is green
- [x] Task file updated (status, branch, pr, Result)

## Out of scope

- Structured error parameters / client-side message building.

## Handoff log

<!-- Append-only. One entry per interrupted session: date, what is done, what is next, branch/commit, gotchas. -->

## Result

Added `formatMoneyMinorRu` (`packages/types`, MSG-07; U+2212 for negatives, `formatMoneyMinor` unchanged) and used it in every
server message that embeds an amount: ALLOCATION_EXCEEDS_INCOME (months, allocations), TRANSFER_EXCEEDS_BALANCE,
EXPENSE_EXCEEDS_BALANCE, ADJUSTMENT_EXCEEDS_BALANCE, ENVELOPE_NOT_EMPTY, and both ARCHIVED_ENVELOPE_WITH_BALANCE warnings
(engine, reporting). The helper is unit-tested in `apps/api/src/common/money-ru.spec.ts` (`packages/types` has no test runner).
Deviation: no OpenAPI change, so `api:generate` was not needed. Mobile `formatRubles` works on API strings with
signed/showNegative/NFR-24 semantics, so it was left untouched.
