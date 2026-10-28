# 0003. Zod-схемы из @family-budget/types вместо class-validator

## Статус

Принято (2026-08-15). Действует.

## Контекст

Один и тот же контракт (запросы API, формы клиента, доменные сущности) нужен и бэкенду, и фронтенду. Дублирование DTO-классов (class-validator) и клиентских схем приводит к расхождению типов. NestJS `ValidationPipe` без DTO-классов фактически мёртвый код: контроллеры принимали `unknown` (см. план `docs/archive/omo/plans/domain-modules-impl.md`).

## Решение

- Единственный источник истины для типов, enum'ов и валидации — Zod-схемы и TS-типы в пакете `packages/types` (`@family-budget/types`).
- Контроллеры валидируют тело через `ZodValidationPipe(<Schema>)` (`apps/api/src/common/pipes`); `@Body() dto: unknown` не допускается.
- Swagger-схемы запросов выводятся из Zod (`zodOpenApiSchema`, `zod-to-json-schema`), вручную не пишутся.
- Клиент использует те же схемы (React Hook Form + Zod resolver).
- Определения типов не дублируются: всегда импорт из `@family-budget/types`.

## Последствия

- Изменение контракта делается в одном месте и сразу видно на обеих сторонах (после регенерации клиента, см. 0012).
- `packages/types` содержит только типы, валидацию и money-хелперы — без бизнес-логики и без импорта из `apps/*`.
- Остаток скелета: в `apps/api/src/main.ts` всё ещё подключён глобальный `ValidationPipe` (class-validator), а `class-validator`/`class-transformer` остаются в зависимостях; их удаление — отдельная задача. Не использовать их в новом коде.
- Не все контроллеры ещё переведены на `ZodValidationPipe` (на момент записи — Envelopes и Allocations); остальные переводятся при реализации задач.
