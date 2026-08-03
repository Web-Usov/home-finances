# packages/types — Общие доменные типы

**Стек:** TypeScript + Zod

## Обзор

Единый источник истины для доменной модели семейного бюджета.
Все сущности, enum'ы, DTO и валидационные схемы выведены из SPECIFICATION.md.
Также включает утилиты конвертации денег (десятичные рубли ↔ целые копейки).

## Структура

```
types/
├── src/
│   ├── entities.ts         # TypeScript-интерфейсы: BudgetMonth, Envelope, Operation и др.
│   ├── schemas.ts          # Zod-схемы + DTO запросов + money-хелперы
│   └── index.ts            # Реэкспорт всего
├── package.json            # Зависит только от `zod`
└── tsconfig.json           # Расширяет `@family-budget/tsconfig/node.json`
```

## Где искать

| Задача | Файл | Примечания |
|--------|------|-----------|
| Добавить новую сущность | `src/entities.ts` | Добавить интерфейс + соответствующую Zod-схему в `schemas.ts` |
| Добавить валидацию API-запроса | `src/schemas.ts` | Паттерн именования: `Create*RequestSchema`, `Update*RequestSchema` |
| Конвертировать формат денег | `src/schemas.ts` | `parseMoneyMinor("15000.00")` → 1500000 (копейки) |
| Форматировать деньги для отображения | `src/schemas.ts` | `formatMoneyMinor(1500000)` → `"15000.00"` |
| Добавить код ошибки | `src/entities.ts` | Добавить в union-тип `ApiErrorCode` |

## Конвенции

- **Именование:** Интерфейсы — PascalCase (например, `BudgetMonth`). Zod-схемы — PascalCase + суффикс `Schema` (например, `BudgetMonthSchema`).
- **Денежные поля:** Именуются `*Minor` в коде, мапятся на `*_minor` в Prisma. Всегда `number` (Int в БД).
- **Периоды:** Строка `YYYY-MM`, валидируется `PeriodSchema` regex `/^\d{4}-\d{2}$/`.
- **Enum'ы:** TS union-типы + Zod `.enum()` (не строковые константы).
- **Даты:** Zod использует `z.coerce.date()` для гибкого парсинга; интерфейсы используют `Date`.
- **Комментарии:** Заголовок каждого файла сущностей ссылается на раздел и строки SPECIFICATION.md.

## Анти-паттерны

- **Никогда не использовать `float` для денег** — только целые копейки. `parseMoneyMinor` и `formatMoneyMinor` — единственные точки конвертации.
- **Никогда не добавлять бизнес-логику сюда** — этот пакет только типы + валидация + хелперы. Никаких расчётов, API-вызовов, UI.
- **Никогда не импортировать из пакетов приложений** — types не должен зависеть от `apps/api` или `apps/mobile`.

## Команды

```bash
cd packages/types
pnpm build              # tsc — вывод в dist/
pnpm typecheck          # tsc --noEmit
```
