# Family Budget — База знаний проекта

**Создано:** 2026-08-03
**Охват:** Монорепозиторий веб-приложения для семейного бюджета (MVP)
**Стек:** pnpm + Turborepo | NestJS + Fastify + Prisma + PostgreSQL | Expo + React Native Web + NativeWind

## Обзор

Приложение для учёта семейного бюджета одного пользователя: ежемесячный доход распределяется по накопительным «конвертам».
В MVP нет встроенной авторизации — приложение работает только в приватной сети.
Все финансовые расчёты выполняются в целых копейках (никогда float). Валюта — RUB, локаль ru-RU.

## Структура

```
.
├── apps/
│   ├── api/              # Бэкенд NestJS: 6 доменных модулей, 14 REST-эндпоинтов, OpenAPI/Swagger
│   └── mobile/           # Фронтенд Expo: 4-табовое приложение (Месяц/История/Аналитика/Конверты)
├── packages/
│   ├── types/            # Zod-схемы + TS-сущности — единый источник истины для доменной модели
│   ├── tsconfig/         # Общие TS-конфиги (base, node, react-native)
│   └── eslint-config/    # Общие правила линтинга для TS + React Native
├── docker-compose.yml    # PostgreSQL 16 + API-сервис
├── .github/workflows/ci.yml
└── turbo.json
```

## Где искать

| Задача | Расположение | Примечания |
|--------|-------------|-----------|
| API-контракт / Swagger | `apps/api/src/modules/*` | Все контроллеры декорированы `@ApiOperation` |
| Схема базы данных | `apps/api/prisma/schema.prisma` | 7 сущностей: BudgetMonth, Envelope, Allocation, Operation, OperationResult, EnvelopeMonthSnapshot, AppSettings |
| Доменные типы | `packages/types/src/` | `entities.ts` (интерфейсы) + `schemas.ts` (Zod) |
| Экраны UI | `apps/mobile/app/(tabs)/` | Файловая маршрутизация Expo Router: month, history, analytics, envelopes |
| Управление состоянием | `apps/mobile/src/stores/` | Zustand: monthStore, envelopeStore, uiStore |
| Генерация API-клиента | `apps/mobile/orval.config.js` | Генерирует React Query хуки из backend swagger.json |
| Расчётный движок | `apps/api/src/modules/calculation-engine/` | Центральный сервис каскадного пересчёта (TODO-заглушка) |

## Карта кода

| Символ | Тип | Расположение | Роль |
|--------|-----|-------------|------|
| AppModule | class | `apps/api/src/app.module.ts` | Соединяет все 7 модулей (health + 6 доменных) |
| main.ts | function | `apps/api/src/main.ts` | Бутстрап Fastify, настройка Swagger, CORS, версионирование |
| HealthController | class | `apps/api/src/health/` | `GET /api/v1/health` |
| MonthsController | class | `apps/api/src/modules/months/` | Жизненный цикл месяца: список, создание, доход, закрытие, повторное открытие |
| EnvelopesController | class | `apps/api/src/modules/envelopes/` | CRUD + архивирование конвертов |
| AllocationsController | class | `apps/api/src/modules/allocations/` | `PUT /api/months/:period/allocations` |
| OperationsController | class | `apps/api/src/modules/operations/` | CRUD для списаний/переводов/корректировок |
| ReportingController | class | `apps/api/src/modules/reporting/` | Дашборд + годовая аналитика |
| CalculationEngineService | class | `apps/api/src/modules/calculation-engine/` | Заглушка каскадного пересчёта |
| useMonthStore | function | `apps/mobile/src/stores/monthStore.ts` | Zustand: текущий период |
| FormInput | function | `apps/mobile/src/components/FormInput.tsx` | Повторно используемый input RHF + NativeWind |
| QueryProvider | function | `apps/mobile/src/providers/QueryProvider.tsx` | Обертка клиента TanStack Query |
| parseMoneyMinor | function | `packages/types/src/schemas.ts` | Десятичная строка рублей → целые копейки |
| formatMoneyMinor | function | `packages/types/src/schemas.ts` | Целые копейки → десятичная строка рублей |

## Конвенции

- **Ссылки в монорепо:** Пакеты подключаются через `workspace:*` в package.json; pnpm резолвит через root.
- **TS-конфиги:** `packages/tsconfig/` предоставляет пресеты base/node/react-native; приложения расширяют нужный пресет.
- **Версионирование бэкенда:** NestJS URI versioning (`/api/v1/...`); версия по умолчанию — `1`.
- **Swagger:** Все контроллеры используют `@ApiTags`, `@ApiOperation`, `@ApiResponse`. Спека доступна по `/api/swagger.json`.
- **Стили фронтенда:** NativeWind v4 — все компоненты используют проп `className` (никогда `StyleSheet.create`).
- **Формы:** React Hook Form + Zod resolver + общий компонент `FormInput`.
- **Состояние:** Серверное состояние → TanStack Query; локальное/UI-состояние → Zustand.
- **Деньги:** Все денежные значения хранятся как целые копейки (`Int` в Prisma, `number` в TS). API принимает десятичные строки (`"15000.00"`).
- **Периоды:** Финансовая дата всегда строка `YYYY-MM`; нет точности до дня.
- **ID:** Все ID в базе данных — UUID v4 (`@id @default(uuid())`).
- **Оптимистичная блокировка:** Поле `version` в BudgetMonth для обнаружения конфликтов.

## Анти-паттерны (этот проект)

- **Никогда не использовать `float` для денег** — только целые копейки. См. `parseMoneyMinor` / `formatMoneyMinor`.
- **Никогда не реализовывать бизнес-логику в заглушках контроллеров без тестов** — каждый TODO ссылается на строки SPECIFICATION.md.
- **Никогда не добавлять авторизацию** в MVP — спека явно исключает её (строка 417).
- **Никогда не коммитить `.env` или секреты** — используйте только шаблоны `.env.example`.
- **Никогда не дублировать определения типов** — всегда импортируйте из `@family-budget/types`.
- **Не использовать `StyleSheet.create`** в мобильном приложении — только NativeWind.

## Уникальные стили

- **Независимость расчётного движка:** Все финансовые формулы должны быть воспроизводимыми и тестируемыми независимо от UI/контроллеров. Движок живёт в модуле `calculation-engine/`.
- **Каскадный пересчёт:** Любое изменение прошлых данных пересчитывает все последующие месяцы атомарно. Заглушка движка обеспечивает это.
- **Жизненный цикл конверта:** Архивирование только при нулевом балансе; иначе сначала перевод или корректировка.
- **Неизменяемость операций:** `sequence_no` никогда не меняется при редактировании; новые операции добавляются в конец.
- **Непокрытые суммы:** Только аналитический показатель — никогда не становятся долгом, никогда не уменьшают будущие пополнения.

## Команды

```bash
# Установить всё
pnpm install

# Dev (параллельно бэкенд + фронтенд)
pnpm dev

# Сборка всего
pnpm build

# Проверка типов / линтинг
pnpm typecheck
pnpm lint

# База данных
pnpm db:up              # Запуск PostgreSQL
pnpm db:migrate         # Prisma migrate dev
pnpm db:seed            # Заполнение AppSettings (RUB, ru-RU)
pnpm db:studio          # Prisma Studio

# Только API
cd apps/api && pnpm build && pnpm start:prod

# Только мобильное
cd apps/mobile && pnpm dev:web

# Генерация API-клиента (требуется запущенный бэкенд)
cd apps/mobile && pnpm orval
```

## Примечания

- `pnpm-workspace.yaml` должен использовать синтаксис `packages:` + `apps:` (не `apps` как отдельный ключ верхнего уровня).
- Бэкенд требует `experimentalDecorators` + `emitDecoratorMetadata` в tsconfig для декораторов NestJS.
- `@fastify/static` v7 требуется NestJS v10 (v8 ломает peer deps).
- Мобильному приложению нужен `nativewind-env.d.ts` для типов `className` на RN-компонентах.
- Orval читает swagger по `http://localhost:3000/api/swagger.json` — сначала запустите бэкенд.
- EAS Build настроен, но нативные приложения явно ВНЕ MVP (спека, строка 594).
