# Аудит соответствия плану

**Дата:** 2026-08-03
**План:** repo-init
**Статус:** ПРОЙДЕН

---

## Логические модули (SPECIFICATION.md строки 419-432)

| Модуль | Ожидается | Найдено | Статус |
|--------|----------|---------|--------|
| Months | Статусы, переходы, доход и закрытие | `apps/api/src/modules/months/` | OK |
| Envelopes | Жизненный цикл конвертов и стартовые остатки | `apps/api/src/modules/envelopes/` | OK |
| Allocations | Месячная таблица распределения | `apps/api/src/modules/allocations/` | OK |
| Operations | Списания, переводы и корректировки | `apps/api/src/modules/operations/` | OK |
| Calculation Engine | Детерминированный каскадный пересчёт | `apps/api/src/modules/calculation-engine/` | OK |
| Reporting | Месячные снимки, история и годовая аналитика | `apps/api/src/modules/reporting/` | OK |

**Результат:** Все 6 логических модулей представлены.

---

## API-эндпоинты (SPECIFICATION.md строки 461-477)

| Метод | Маршрут | Контроллер | Статус |
|--------|--------|-----------|--------|
| GET | /api/months | MonthsController.list | OK |
| POST | /api/months | MonthsController.create | OK |
| PATCH | /api/months/{period} | MonthsController.updateIncome | OK |
| PUT | /api/months/{period}/allocations | AllocationsController.save | OK |
| POST | /api/months/{period}/close | MonthsController.close | OK |
| POST | /api/months/{period}/reopen | MonthsController.reopen | OK |
| GET/POST | /api/envelopes | EnvelopesController.list/create | OK |
| PATCH | /api/envelopes/{id} | EnvelopesController.update | OK |
| POST | /api/envelopes/{id}/archive | EnvelopesController.archive | OK |
| GET/POST | /api/operations | OperationsController.list/create | OK |
| PATCH/DELETE | /api/operations/{id} | OperationsController.update/remove | OK |
| GET | /api/dashboard/monthly | ReportingController.monthlyDashboard | OK |
| GET | /api/analytics/yearly | ReportingController.yearlyAnalytics | OK |
| GET | /api/health | HealthController.health | OK (дополнительно) |

**Результат:** Все 14 маршрутов спеки + 1 health check реализованы как заглушки.

---

## Модель данных (SPECIFICATION.md строки 437-446)

| Сущность | Поле схемы | Prisma Model | Статус |
|----------|-----------|--------------|--------|
| budget_month | period, status, income_minor, version | BudgetMonth | OK |
| envelope | name, status, created_period, archived_period, display_order | Envelope | OK |
| allocation | month_id, envelope_id, amount_minor | Allocation | OK |
| operation | month_id, sequence_no, type, source_envelope_id, destination_envelope_id, requested_minor, sign, is_initial, comment | Operation | OK |
| operation_result | covered_minor, uncovered_minor, source_balance_before/after, destination_balance_before/after | OperationResult | OK |
| envelope_month_snapshot | opening, initial, allocation, expenses_requested, expenses_covered, adjustment_applied, transfers_in/out, closing, uncovered_by_type | EnvelopeMonthSnapshot | OK |
| app_settings | currency, locale, schema_version | AppSettings | OK |

**Результат:** Все 7 сущностей совпадают. Ограничения соблюдены: UUID, Int для копеек, уникальные композиты, внешние ключи, onDelete: Cascade.

---

## Проверка стека

| Требование | Реализация | Статус |
|------------|-----------|--------|
| pnpm + Turborepo | `package.json`, `pnpm-workspace.yaml`, `turbo.json` | OK |
| Expo + React Native + Expo Router | `apps/mobile/` с Expo SDK 51 | OK |
| React Native Web | зависимость `react-native-web`, конфиг web bundler | OK |
| NativeWind | `tailwind.config.js`, `global.css`, `nativewind-env.d.ts` | OK |
| TanStack Query | `QueryProvider.tsx`, `@tanstack/react-query` | OK |
| React Hook Form + Zod | `FormInput.tsx`, `@hookform/resolvers` | OK |
| Zustand | `monthStore.ts`, `envelopeStore.ts`, `uiStore.ts` | OK |
| NestJS + Fastify | `apps/api/src/main.ts` с FastifyAdapter | OK |
| REST + OpenAPI | Все контроллеры с декораторами Swagger | OK |
| Orval | `orval.config.js` с react-query клиентом | OK |
| PostgreSQL | `docker-compose.yml` с postgres:16-alpine | OK |
| Prisma | `schema.prisma` с 7 моделями, миграция применена | OK |
| EAS Build заглушка | `eas.json` с профилями dev/preview/prod | OK |
| Docker + CI | `Dockerfile`, `.github/workflows/ci.yml` | OK |

---

## Результаты верификации

- [x] `pnpm install` успешен из корня (6 workspace-проектов)
- [x] `pnpm --filter @family-budget/types build` завершается с 0
- [x] `pnpm --filter @family-budget/api build` завершается с 0
- [x] `pnpm --filter @family-budget/mobile typecheck` завершается с 0
- [x] `npx prisma validate` завершается с 0
- [x] `npx prisma migrate dev` успешно применяет миграцию
- [x] `npx prisma db seed` заполняет AppSettings
- [x] Бэкенд стартует и `/api/v1/health` возвращает HTTP 200
- [x] `/api/swagger.json` возвращает HTTP 200 (OpenAPI-спека доступна)
- [x] `/api/v1/months` возвращает HTTP 200 (stub-ответ)
- [x] Docker Compose PostgreSQL стартует и проходит healthcheck
- [x] `.env.example` файлы существуют для всех сервисов (нет реальных секретов)
- [x] Нет `node_modules` или `.env` файлов в git tracking

---

**Заключение аудита: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ**
