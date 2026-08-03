# apps/api — База знаний бэкенда

**Стек:** NestJS 10 + Fastify + Prisma + PostgreSQL + Swagger/OpenAPI

## Обзор

REST API для домена семейного бюджета. 6 модулей, 14 эндпоинтов, все — заглушки со ссылками на SPECIFICATION.md.
Расчётный движок — единственный stateless-сервис; все остальные будут делегировать Prisma + движок.

## Структура

```
api/
├── src/
│   ├── main.ts                 # Бутстрап Fastify, Swagger, CORS, URI-версионирование
│   ├── app.module.ts           # Соединяет Health + 6 доменных модулей
│   ├── health/
│   │   └── health.controller.ts    # GET /api/v1/health
│   └── modules/
│       ├── months/             # Жизненный цикл месяца, доход, закрытие, повторное открытие
│       ├── envelopes/          # CRUD + архивирование
│       ├── allocations/        # PUT /api/months/:period/allocations
│       ├── operations/         # CRUD для списаний/переводов/корректировок
│       ├── calculation-engine/ # Каскадный пересчёт (stateless, общий)
│       └── reporting/          # Дашборд + годовая аналитика
├── prisma/
│   ├── schema.prisma           # 7 сущностей, enum'ы, связи, UUID, Int-копейки
│   ├── seed.ts               # Идемпотентный сид AppSettings (RUB, ru-RU)
│   └── migrations/
├── package.json                # @nestjs/platform-fastify, @fastify/static@7, prisma
└── Dockerfile                  # Многоступенчатый: builder → production
```

## Где искать

| Задача | Файл | Примечания |
|--------|------|-----------|
| Добавить новый API-эндпоинт | `src/modules/<домен>/<домен>.controller.ts` | Следовать существующему паттерну: `@Controller`, `@ApiTags`, `@ApiOperation` |
| Изменить схему базы данных | `prisma/schema.prisma` | Затем запустить `npx prisma migrate dev` |
| Реализовать пересчёт | `src/modules/calculation-engine/calculation-engine.service.ts` | Должен быть детерминированным, протестированным, независимым от HTTP-слоя |
| Добавить сид-данные | `prisma/seed.ts` | Использовать `upsert` с фиксированным UUID для идемпотентности |
| Валидировать DTO запросов | Контроллеры используют `@Body() dto: unknown` — заменить на Zod-схемы из `@family-budget/types` |

## Конвенции

- **Контроллеры:** Все методы декорированы `@ApiOperation` + `@ApiResponse`. Возвращают plain-объекты (не классы).
- **Сервисы:** Пока заглушки, возвращающие `{ message: 'Not implemented' }`. У каждого есть TODO-комментарий со ссылкой на строки SPECIFICATION.md.
- **Prisma:** UUID первичные ключи (`@id @default(uuid()) @db.Uuid`). Денежные поля как `Int` (`@map("*_minor")`).
- **Версионирование:** Все маршруты под `/api/v1/...` через NestJS `VersioningType.URI`.
- **Коды ошибок:** Определены в `packages/types/src/entities.ts`: `ALLOCATION_EXCEEDS_INCOME`, `MONTH_LOCKED`, `TRANSFER_EXCEEDS_BALANCE`, `ENVELOPE_NOT_EMPTY`, `VERSION_CONFLICT`.

## Анти-паттерны

- **Не реализовывать float-арифметику для денег** — использовать `parseMoneyMinor` / `formatMoneyMinor` из `@family-budget/types`.
- **Не пропускать миграции Prisma** — всегда генерировать и применять перед изменением кода, зависящего от схемы.
- **Не помещать HTTP-логику в CalculationEngineService** — движок должен быть чистыми функциями + запросами Prisma только.
- **Не добавлять auth middleware** — в MVP нет авторизации (спека, строка 417).

## Команды

```bash
cd apps/api
pnpm build              # nest build
pnpm dev                # nest start --watch
pnpm typecheck          # tsc --noEmit
pnpm test               # jest
pnpm start:prod         # node dist/main

# Prisma
npx prisma migrate dev  # Создать + применить миграцию
npx prisma db seed      # Запустить seed.ts
npx prisma studio       # Web UI для БД
npx prisma generate     # Перегенерировать клиент после изменения схемы
```
