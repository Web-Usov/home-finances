# domain-modules-impl — План работ

## TL;DR (Для людей)

**Что вы получите:** Полную бизнес-логику всех 6 доменных модулей семейного бюджета: расчётный движок (каскадный пересчёт балансов), управление конвертами, жизненный цикл месяцев, распределение дохода, операции (списания/переводы/корректировки), отчётность. Каждый модуль включает бэкенд (NestJS + Prisma), интеграционные тесты и параллельный фронтенд (Expo + Orval + React Query).

**Почему этот подход:** Расчётный движок реализуется первым как ядро — все остальные модули зависят от него. Параллельный фронтенд через субагентов даёт немедленную визуальную обратную связь. Модульные тесты покрывают все формулы с непокрытыми суммами, интеграционные — статусные переходы и каскадный пересчёт.

**Что НЕ будет сделано:** E2E браузерные тесты (вне выбранного scope), нативные мобильные сборки (EAS остаётся заглушкой), авторизация, банковские интеграции, импорт/экспорт.

**Трудоёмкость:** Очень большая — 8 волн, ~50+ задач
**Риск:** Высокий — расчётный движок математически сложный; ошибка в формулах = неверные балансы

**Решения для проверки:**
1. Сначала Calculation Engine (ядро), затем остальные — подтверждено.
2. Параллельный фронтенд через субагентов — подтверждено.
3. Модульные + интеграционные тесты (без E2E) — подтверждено.

---

> TL;DR (машина): Очень большая / Высокий / Полная реализация 6 модулей + тесты + параллельный фронтенд

## Охват
### Обязательно
- Реализация CalculationEngineService: детерминированный каскадный пересчёт, покрытие всех формул модульными тестами
- Реализация EnvelopesService: CRUD, архивирование при нулевом балансе, уникальность названия без учёта регистра
- Реализация MonthsService: создание, доход, закрытие, переоткрытие, статусные переходы по спеке
- Реализация AllocationsService: PUT распределения, валидация Σ ≤ income, копирование из предыдущего месяца
- Реализация OperationsService: списания, переводы, корректировки, sequence_no, неизменяемость порядка
- Реализация ReportingService: дашборд (месячный) + годовая аналитика (3 отчёта)
- Интеграционные тесты API: статусы, транзакции, каскадный пересчёт, ошибки 409/422
- Параллельный фронтенд для каждого модуля: Orval + React Query + Zustand + UI-экраны
- Обновление API-контрактов: замена `unknown` DTO на Zod-схемы из `@family-budget/types`
- Обработка edge cases: оптимистичная блокировка (version), архивный конверт с остатком, единственный reopened месяц
- Глобальная обработка ошибок: ExceptionFilter с ApiErrorCode → 422/409
- ZodValidationPipe для валидации DTO в контроллерах
- Атомарные транзакции: source-мутация + каскадный пересчёт в одной Prisma `$transaction`
- Генерация warnings (ApiWarning[]) в ответах всех мутаций

### Категорически нельзя (ограничители, anti-slop, границы охвата)
- НЕТ E2E тестов с реальным браузером
- НЕТ нативных мобильных сборок (EAS — заглушка)
- НЕТ авторизации/Clerk
- НЕТ банковских интеграций
- НЕТ импорта/экспорта/backup
- НЕТ изменения структуры Prisma-схемы (только реализация существующей)
- НЕТ float-арифметики для денег — только целые копейки
- НЕТ размещения бизнес-логики в контроллерах — только в сервисах и движке
- НЕТ ручной визуальной верификации UI — QA должна быть автоматизируемой агентом

## Стратегия верификации
> Нулевое вмешательство человека — вся верификация выполняется агентом.
- Решение по тестам: tests-after для Calculation Engine (сложные формулы → сначала код, потом тесты); TDD для простых CRUD (Envelopes)
- Модульные тесты: Jest, покрытие всех ветвей с непокрытыми суммами (SPECIFICATION.md строки 527-528)
- Интеграционные тесты: Supertest + NestJS testing module, проверка статусных переходов и каскадного пересчёта
- QA на уровне каждого todo: happy path + failure path, конкретная команда/запрос, путь к evidence
- Доказательства: `.omo/evidence/task-<N>-domain-modules-impl.<ext>`

## Стратегия выполнения
### Параллельные волны выполнения
> Целевой показатель: 5-8 todo на волну.

**Волна 0 (2 задачи): Инфраструктура тестирования и валидации**
- Создание ZodValidationPipe
- Создание глобального ExceptionFilter

**Волна 1 (6 задач): Calculation Engine — ядро системы**
- Stateless сервис с чистыми функциями
- Применение операций: expense, transfer, adjustment, initial_balance
- Каскадный пересчёт от самого раннего затронутого месяца
- Пересоздание OperationResult + EnvelopeMonthSnapshot
- Модульные тесты всех формул и пограничных случаев

**Волна 2 (5 задач): Envelopes — CRUD + архивирование**
- Не зависит от движка (нет пересчёта при CRUD)
- Параллельно: UI «Конверты» (список, создание, редактирование, архивирование)

**Волна 3 (7 задач): Months — жизненный цикл**
- Зависит от движка (доход, закрытие, переоткрытие триггерят пересчёт)
- Параллельно: UI «Месяц» (дашборд, переключатель периода, статус, доход)

**Волна 4 (6 задач): Allocations — распределение дохода**
- Зависит от движка (изменение распределения → пересчёт)
- Валидация Σ ≤ income
- Параллельно: UI редактор распределения

**Волна 5 (8 задач): Operations — операции**
- Самый сложный модуль: sequence_no, неизменяемость, непокрытые суммы
- Типы: expense, transfer, adjustment, initial_balance
- Параллельно: UI формы операций + история

**Волна 6 (5 задач): Reporting — отчётность**
- Читает snapshots (производные данные)
- Дашборд месяца + 3 годовых отчёта
- Параллельно: UI «Аналитика»

**Волна 7 (4 задачи): Интеграция и финальная верификация**
- End-to-end сквозные сценарии
- Проверка AC-01..AC-22
- Полный проход Docker Compose
- Проверка сохранения после перезапуска

### Матрица зависимостей (исправленная)
| Todo | Зависит от | Блокирует | Можно параллельно с |
|------|-----------|-----------|---------------------|
| 1 | none | 2 | none |
| 2 | none | 3,4,5,6,7,8,9,10,11,12,13 | none |
| 3 | 1 | 7,8,9,10,11 | none |
| 4 | 1,2 | 10 | 3 |
| 5 | 1,2 | 10 | 3,4 |
| 6 | 3,4,5 | 14,15,16,17,18,19,20 | 7,8,9 |
| 7 | 2 | 14,15 | 3,4,5,6 |
| 8 | 2 | 14,15 | 3,4,5,6,7 |
| 9 | 3,4,5,6 | 21 | 7,8 |
| 10 | 3,4,5,6 | 21 | 7,8,9 |
| 11 | 7,8,9 | 22 | 10 |
| 12 | 7,8,9 | 22 | 10,11 |
| 13 | 7,8,9,10 | 23 | 11,12 |
| 14 | 11 | 24 | 12,13 |
| 15 | 11,12 | 24 | 13,14 |
| 16 | 12,13,14,15 | 25 | 14,15 |
| 17 | 13,14,15,16 | 25 | 16 |
| 18 | 11 | 26 | 14,15 |
| 19 | 15 | 26 | 17,18 |
| 20 | 16,17 | 27 | 18,19 |
| 21 | 9,10 | 28 | 17,18,19,20 |
| 22 | 14,15,16,17,18,19,20 | 29,30 | 21 |
| 23 | 21 | 31 | 22 |
| 24 | 21,22 | 31 | 23 |
| 25 | 23,24 | 32 | 23,24 |
| 26 | 25 | 32 | 25 |
| 27 | 25,26 | 32 | 26 |
| 28 | 22 | 33 | 27 |
| 29 | 22 | 33 | 27,28 |
| 30 | 28,29 | 33 | 29 |
| 31 | 23,24,25 | 34 | 27,28,29,30 |
| 32 | 27,28,29,30,31 | none | 33 |
| 33 | 32 | none | 34 |
| 34 | 32 | none | 33 |

## Todos
> Реализация + Тест = ОДИН todo. Никогда не разделять.

### Волна 0: Инфраструктура валидации

- [x] 1. Создать ZodValidationPipe для NestJS
  Что делать / НЕЛЬЗЯ делать: Создать `apps/api/src/common/pipes/zod-validation.pipe.ts` — pipe, принимающий Zod-схему и выбрасывающий `ZodValidationException` с 422. Зарегистрировать глобально в `main.ts` или использовать `@UsePipes()` в контроллерах. НЕЛЬЗЯ использовать NestJS `ValidationPipe` (class-validator) — он dead code без DTO-классов.
  Параллелизация: Волна 0 | Заблокировано: none | Блокирует: 2
  Ссылки: packages/types/src/schemas.ts (все Zod-схемы)
  Критерий приёмки: `@UsePipes(new ZodValidationPipe(CreateEnvelopeRequestSchema))` валидирует `{ name: "" }` → 422 с сообщением об ошибке.
  QA: `cd apps/api && pnpm test -- zod-validation.pipe.spec.ts` — тесты проходят. Доказательства: `.omo/evidence/task-1-domain-modules-impl.log`
  Коммит: Y | feat(api): add zod validation pipe

- [x] 2. Создать глобальный ExceptionFilter
  Что делать / НЕЛЬЗЯ делать: Создать `apps/api/src/common/filters/domain-exception.filter.ts` — фильтр, перехватывающий кастомные доменные исключения (ValidationException → 422, ConflictException → 409) и формирующий ответ `{ error: ApiErrorCode, message: string }`. Зарегистрировать глобально в `main.ts`. Создать классы исключений: `ValidationException`, `ConflictException`, `NotFoundException`. НЕЛЬЗЯ возвращать стандартные NestJS-ошибки без кодов.
  Параллелизация: Волна 0 | Заблокировано: none | Блокирует: все
  Ссылки: SPECIFICATION.md строки 487-489 (коды ошибок), entities.ts (ApiErrorCode)
  Критерий приёмки: `throw new ConflictException('MONTH_LOCKED')` → HTTP 409 + `{ error: 'MONTH_LOCKED', message: 'Месяц закрыт' }`
  QA: `cd apps/api && pnpm test -- domain-exception.filter.spec.ts` — тесты проходят. Доказательства: `.omo/evidence/task-2-domain-modules-impl.log`
  Коммит: Y | feat(api): add global exception filter with api error codes

### Волна 1: Calculation Engine (Ядро)

- [x] 3. Реализовать применение одной операции к балансу
  Что делать / НЕЛЬЗЯ делать: Реализовать `applyOperation()` для всех типов:
  - expense: `sourceBalanceAfter = max(0, sourceBalanceBefore - requested)`, covered = min(requested, sourceBalanceBefore), uncovered = requested - covered
  - transfer: source уменьшается, destination увеличивается. Если requested > sourceBalance → covered = sourceBalance (непокрытая = разница), но сумма перевода НЕ меняется
  - adjustment '+': увеличение на всю сумму, uncovered = 0
  - adjustment '-': `sourceBalanceAfter = max(0, sourceBalanceBefore - requested)`, covered = min(requested, sourceBalanceBefore), uncovered = requested - covered
  - initial_balance: увеличение на всю сумму, uncovered = 0, не входит в показатели месяца
  НЕЛЬЗЯ использовать float. Функция принимает `sourceBalanceBefore, destinationBalanceBefore?, requested, type, sign?` и возвращает `{ sourceBalanceAfter, destinationBalanceAfter?, covered, uncovered }`.
  Параллелизация: Волна 1 | Заблокировано: none | Блокирует: 6,7,8,9,10,11
  Ссылки: SPECIFICATION.md строки 142-187 (типы операций), строки 233-262 (каскадный пересчёт)
  Критерий приёмки: 
  - `applyOperation(10000, 'expense', 15000)` → `{ sourceBalanceAfter: 0, covered: 10000, uncovered: 5000 }`
  - `applyOperation(10000, 'transfer', 6000, null, 3000)` → `{ sourceBalanceAfter: 4000, destinationBalanceAfter: 9000, covered: 6000, uncovered: 0 }`
  - `applyOperation(10000, 'transfer', 10000, null, 3000)` → `{ sourceBalanceAfter: 0, destinationBalanceAfter: 13000, covered: 10000, uncovered: 4000 }` (AC-08)
  - `applyOperation(10000, 'adjustment', 5000, '+')` → `{ sourceBalanceAfter: 15000, covered: 5000, uncovered: 0 }`
  - `applyOperation(10000, 'adjustment', 15000, '-')` → `{ sourceBalanceAfter: 0, covered: 10000, uncovered: 5000 }`
  - `applyOperation(0, 'initial_balance', 5000)` → `{ sourceBalanceAfter: 5000, covered: 5000, uncovered: 0 }`
  QA: `cd apps/api && pnpm test -- calculation-engine.service.spec.ts` — все unit-тесты проходят. Доказательства: `.omo/evidence/task-3-domain-modules-impl.log`
  Коммит: Y | feat(engine): implement operation application formulas

- [x] 4. Реализовать каскадный пересчёт от месяца
  Что делать / НЕЛЬЗЯ делать: Реализовать `recalculateFrom(period: string)` — найти самый ранний затронутый месяц, восстановить opening balances из последнего неизменённого snapshot, применить initial + allocation + operations по sequence_no, пересоздать OperationResult и EnvelopeMonthSnapshot для всех затронутых месяцев. Детектировать конфликт «Архивный конверт с остатком» — если архивированный конверт получает ненулевой balance, добавить warning. НЕЛЬЗЯ использовать float. НЕЛЬЗЯ изменять source-данные (Operation, Allocation) — только производные (Result, Snapshot).
  Параллелизация: Волна 1 | Заблокировано: 3 | Блокирует: 14,15,16,17,18,19,20
  Ссылки: SPECIFICATION.md строки 233-262 (каскадный пересчёт), строки 13-18 (шаги пересчёта), строка 259 (архивный конфликт)
  Критерий приёмки: Пересчёт 2 месяцев с операциями даёт ожидаемые closing balances и covered/uncovered; пересчёт не меняет sequence_no операций; архивный конверт с ненулевым остатком после пересчёта генерирует warning.
  QA: `cd apps/api && pnpm test -- calculation-engine.service.spec.ts` — интеграционные тесты пересчёта проходят. Доказательства: `.omo/evidence/task-4-domain-modules-impl.log`
  Коммит: Y | feat(engine): implement cascade recalculation engine

- [x] 5. Покрыть модульными тестами все формулы
  Что делать / НЕЛЬЗЯ делать: Написать Jest-тесты для всех ветвей: покрытое списание, непокрытое списание, перевод в пределах остатка, перевод сверх остатка, положительная корректировка, отрицательная корректировка сверх остатка, стартовый остаток. Проверить AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-11. НЕЛЬЗЯ пропускать пограничные случаи (0, максимальные значения).
  Параллелизация: Волна 1 | Заблокировано: 3 | Блокирует: 14,15,16,17,18,19,20
  Ссылки: SPECIFICATION.md строки 527-528 (тестирование движка), AC-05..AC-13
  Критерий приёмки: Coverage ≥ 95% для calculation-engine.service.ts; все AC-подобные сценарии покрыты.
  QA: `cd apps/api && pnpm test -- --coverage --collectCoverageFrom="src/modules/calculation-engine/**/*.ts"` — coverage отчёт. Доказательства: `.omo/evidence/task-5-domain-modules-impl-coverage.html`
  Коммит: Y | test(engine): add unit tests for all operation formulas

- [x] 6. Реализовать пересоздание OperationResult
  Что делать / НЕЛЬЗЯ делать: Внутри пересчёта — удалить старые OperationResult для затронутых месяцев, создать новые с полями: coveredMinor, uncoveredMinor, sourceBalanceBefore/After, destinationBalanceBefore/After. НЕЛЬЗЯ оставлять orphaned записи.
  Параллелизация: Волна 1 | Заблокировано: 4 | Блокирует: 14,15,16,17,18,19,20
  Ссылки: SPECIFICATION.md строки 443 (OperationResult модель), строки 307-311 (общие поля)
  Критерий приёмки: После пересчёта количество OperationResult равно количеству Operation в затронутых месяцах; все поля заполнены корректно.
  QA: `cd apps/api && pnpm test -- calculation-engine.service.spec.ts` — тесты на пересоздание Result проходят. Доказательства: `.omo/evidence/task-6-domain-modules-impl.log`
  Коммит: Y | feat(engine): implement operation result recreation

- [x] 7. Реализовать пересоздание EnvelopeMonthSnapshot
  Что делать / НЕЛЬЗЯ делать: Внутри пересчёта — удалить старые Snapshot для затронутых месяцев, создать новые с полями: opening, initial, allocation, expensesRequested/Covered, adjustmentApplied, transfersIn/Out, closing, uncoveredByType. НЕЛЬЗЯ оставлять orphaned записи. uncoveredByType — JSON с разбивкой по типам операций. Для переводов: transfersIn не увеличивает «Пополнено», transfersOut не увеличивает «Списано» (AC-19).
  Параллелизация: Волна 1 | Заблокировано: 4 | Блокирует: 14,15,16,17,18,19,20
  Ссылки: SPECIFICATION.md строки 444 (EnvelopeMonthSnapshot модель), строка 327 (переводы на дашборде)
  Критерий приёмки: После пересчёта каждый затронутый месяц имеет snapshot для каждого конверта с closing = opening + all flows; переводы корректно отражены.
  QA: `cd apps/api && pnpm test -- calculation-engine.service.spec.ts` — тесты на snapshot проходят. Доказательства: `.omo/evidence/task-7-domain-modules-impl.log`
  Коммит: Y | feat(engine): implement envelope month snapshot recreation

- [ ] 8. Добавить интеграцию движка с Prisma (транзакционность)
  Что делать / НЕЛЬЗЯ делать: Обернуть весь каскадный пересчёт в Prisma `$transaction`. Транзакция должна: 1) удалить старые Result + Snapshot, 2) создать новые, 3) обновить version затронутых BudgetMonth, 4) вернуть warnings. НЕЛЬЗЯ коммитить промежуточные состояния. НЕЛЬЗЯ забывать инкремент version для optimistic locking. Создать публичный метод `recalculateMonthAtomically(monthId: string)` для вызова из других сервисов.
  Параллелизация: Волна 1 | Заблокировано: 5,6,7 | Блокирует: 14,15,16,17,18,19,20
  Ссылки: SPECIFICATION.md строки 505-511 (надёжность), строки 261 (транзакционность)
  Критерий приёмки: Транзакция коммитится атомарно; при ошибке — rollback; version всех затронутых месяцев увеличивается на 1; warnings возвращаются.
  QA: `cd apps/api && pnpm test -- calculation-engine.integration.spec.ts` — интеграционный тест транзакции проходит. Доказательства: `.omo/evidence/task-8-domain-modules-impl.log`
  Коммит: Y | feat(engine): add atomic transaction wrapper for recalculation

### Волна 2: Envelopes (Конверты)

- [x] 9. Реализовать CRUD EnvelopesService
  Что делать / НЕЛЬЗЯ делать: list() — все конверты с текущим балансом (читать из последнего snapshot; если snapshot нет — 0). create() — проверить уникальность названия (case-insensitive, сравнение через `LOWER()`), создать конверт, если есть initialBalance — создать стартовую корректировку-операцию в текущем открытом/реopened месяце. update() — переименовать или изменить displayOrder. НЕЛЬЗЯ позволять дубли названий. НЕЛЬЗЯ делать финансовый пересчёт при переименовании. НЕЛЬЗЯ создавать/архивировать в закрытом месяце.
  Параллелизация: Волна 2 | Заблокировано: 2 | Блокирует: 12,13
  Ссылки: SPECIFICATION.md строки 263-296 (управление конвертами), строки 277 (создание разрешено только в открытом/реopened/draft)
  Критерий приёмки: `POST /api/envelopes` с `{ name: "Еда" }` → 201 и конверт; повторный POST с `{ name: "еда" }` → 409 DUPLICATE_NAME; `POST /api/envelopes` в закрытом месяце → 409 MONTH_LOCKED; `PATCH /api/envelopes/:id` с `{ name: "Продукты" }` → 200.
  QA: `cd apps/api && pnpm test -- envelopes.service.spec.ts` — все тесты проходят. Доказательства: `.omo/evidence/task-9-domain-modules-impl.log`
  Коммит: Y | feat(envelopes): implement crud with name uniqueness and closed-month check

- [x] 10. Реализовать архивирование конверта
  Что делать / НЕЛЬЗЯ делать: archive() — проверить баланс = 0 через последний snapshot. Если ≠ 0 → 409 ENVELOPE_NOT_EMPTY с текущим остатком. Если = 0 → установить status='archived', archivedPeriod=текущий месяц. Запретить в закрытом месяце. НЕЛЬЗЯ архивировать конверт с ненулевым балансом. НЕЛЬЗЯ архивировать в закрытом месяце.
  Параллелизация: Волна 2 | Заблокировано: 9 | Блокирует: 12,13
  Ссылки: SPECIFICATION.md строки 287-295 (архивирование), строка 372 (сообщение об ошибке)
  Критерий приёмки: Архивирование конверта с балансом 0 → 200; архивирование с балансом 5000 → 409 с сообщением «Сначала обнулите конверт. Текущий остаток: 50.00 ₽.»; архивирование в закрытом месяце → 409 MONTH_LOCKED.
  QA: `cd apps/api && pnpm test -- envelopes.service.spec.ts` — тесты архивирования проходят. Доказательства: `.omo/evidence/task-10-domain-modules-impl.log`
  Коммит: Y | feat(envelopes): implement archive with zero-balance and closed-month checks

- [x] 11. Заменить DTO в контроллерах Envelopes на Zod-схемы
  Что делать / НЕЛЬЗЯ делать: В `EnvelopesController` заменить `@Body() dto: unknown` на типизированные DTO через `@UsePipes(new ZodValidationPipe(...))`. Использовать `CreateEnvelopeRequestSchema`, `UpdateEnvelopeRequestSchema` из `@family-budget/types`. Обновить swagger-декораторы для отображения схем. НЕЛЬЗЯ оставлять `unknown`.
  Параллелизация: Волна 2 | Заблокировано: 1,9 | Блокирует: 21
  Ссылки: packages/types/src/schemas.ts (CreateEnvelopeRequestSchema, UpdateEnvelopeRequestSchema)
  Критерий приёмки: Контроллер использует типизированные DTO; swagger отображает схемы запросов.
  QA: `cd apps/api && pnpm build` завершается с 0; `pnpm typecheck` завершается с 0. Доказательства: `.omo/evidence/task-11-domain-modules-impl.log`
  Коммит: Y | refactor(envelopes): replace unknown dto with zod schemas and validation pipe

- [x] 12. Добавить интеграционные тесты Envelopes API
  Что делать / НЕЛЬЗЯ делать: Написать Supertest-тесты для всех маршрутов: GET /api/envelopes, POST /api/envelopes, PATCH /api/envelopes/:id, POST /api/envelopes/:id/archive. Проверить: уникальность (case-insensitive), архивирование ненулевого, 404 для несуществующего ID, закрытый месяц блокирует. НЕЛЬЗЯ пропускать failure paths.
  Параллелизация: Волна 2 | Заблокировано: 9,10,11 | Блокирует: none
  Ссылки: SPECIFICATION.md строки 471-473 (API-контракт)
  Критерий приёмки: Все 4 маршрута покрыты happy + failure тестами; coverage ≥ 80%.
  QA: `cd apps/api && pnpm test -- --runInBand` — 3 suites passed, 69 tests passed; `cd apps/api && pnpm test -- --runInBand --coverage` — All files 94.63% stmts, modules/envelopes 99.02% stmts; `cd apps/api && pnpm typecheck` — success. Доказательства: `.omo/evidence/task-12-domain-modules-impl.log`
  Коммит: Y | test(envelopes): add integration tests for all endpoints

- [ ] 13. Сгенерировать Orval-клиент и обновить UI «Конверты»
  Что делать / НЕЛЬЗЯ делать: Запустить `cd apps/mobile && pnpm orval` (требуется запущенный бэкенд со swagger). Обновить экран `apps/mobile/app/(tabs)/envelopes.tsx` — список конвертов с балансами, форма создания, кнопки редактирования/архивирования. Использовать React Query для запросов, Zustand для локального состояния формы. НЕЛЬЗЯ использовать заглушки-моки.
  Параллелизация: Волна 2 | Заблокировано: 11 | Блокирует: 24
  Ссылки: apps/mobile/orval.config.js, SPECIFICATION.md строки 329-339 (экраны)
  Критерий приёмки: Экран «Конверты» показывает список с балансами; создание обновляет список; архивирование показывает ошибку при ненулевом балансе.
  QA: `cd apps/mobile && pnpm typecheck` — 0 ошибок; Orval сгенерировал файлы; компоненты рендерятся без ошибок. Доказательства: `.omo/evidence/task-13-domain-modules-impl.log`
  Коммит: Y | feat(mobile): implement envelopes screen with api integration

### Волна 3: Months (Месяцы)

- [ ] 14. Реализовать создание месяца
  Что делать / НЕЛЬЗЯ делать: create() — если нет месяцев: создать с статусом 'open'. Если есть открытый: создать следующий как 'draft'. Если есть черновик: ошибка (только один черновик). Если последний 'closed' и нет черновика: создать следующий как 'open'. Период — следующий месяц без пропусков. Доход по умолчанию = 0. Скопировать allocations из предыдущего месяца (Todo 19). НЕЛЬЗЯ создавать месяц с пропуском.
  Параллелизация: Волна 3 | Заблокировано: 8,9 | Блокирует: 22,23
  Ссылки: SPECIFICATION.md строки 198-232 (жизненный цикл), строки 209-218 (правила переходов)
  Критерий приёмки: Первый POST → open; второй POST при открытом → draft; третий POST при существующем draft → 409; POST после closed без draft → open; POST с пропуском → 422.
  QA: `cd apps/api && pnpm test -- months.service.spec.ts` — тесты создания проходят. Доказательства: `.omo/evidence/task-14-domain-modules-impl.log`
  Коммит: Y | feat(months): implement month creation with status transitions and auto-promotion

- [ ] 15. Реализовать обновление дохода
  Что делать / НЕЛЬЗЯ делать: updateIncome() — проверить version (optimistic locking), проверить статус не 'closed'. Обновить income_minor. Запустить каскадный пересчёт от этого месяца через `recalculateMonthAtomically`. Вернуть обновлённую сводку + warnings. НЕЛЬЗЯ менять доход закрытого месяца. НЕЛЬЗЯ игнорировать version.
  Параллелизация: Волна 3 | Заблокировано: 8 | Блокирует: 22,23
  Ссылки: SPECIFICATION.md строки 467 (API PATCH income), строка 457 (optimistic locking)
  Критерий приёмки: PATCH дохода открытого месяца → 200 + обновлённая сводка; PATCH дохода закрытого → 409 MONTH_LOCKED; PATCH с неверным version → 409 VERSION_CONFLICT.
  QA: `cd apps/api && pnpm test -- months.service.spec.ts` — тесты дохода проходят. Доказательства: `.omo/evidence/task-15-domain-modules-impl.log`
  Коммит: Y | feat(months): implement income update with recalculation and version check

- [ ] 16. Реализовать закрытие и переоткрытие месяца
  Что делать / НЕЛЬЗЯ делать: close() — проверить version, проверить статус 'open' или 'reopened'. Проверить жёсткие инварианты (allocation ≤ income). Установить 'closed'. Если status был 'open' и есть черновик — автоматически сделать его 'open'. Если status был 'reopened' — НЕ переводить черновик в 'open' (строка 231). reopen() — проверить version, проверить 'closed'. Установить 'reopened'. Проверить, что нет другого reopened (только один в MVP). Показать диапазон пересчёта (все последующие месяцы). Запустить пересчёт. Вернуть диапазон + warnings. Сохранить статусы других месяцев. НЕЛЬЗЯ закрывать draft. НЕЛЬЗЯ иметь два reopened. НЕЛЬЗЯ блокировать закрытие при непокрытых операциях.
  Параллелизация: Волна 3 | Заблокировано: 8 | Блокирует: 22,23
  Ссылки: SPECIFICATION.md строки 207-231 (переходы), строки 469-470 (API close/reopen)
  Критерий приёмки: close open + draft → 200, draft становится open; close draft → 409; close reopened → 200, draft НЕ меняет статус; close при allocation > income → 409; close при непокрытых операциях → 200; reopen закрытого → 200 + диапазон; reopen при существующем reopened → 409; другие месяцы сохраняют статусы.
  QA: `cd apps/api && pnpm test -- months.service.spec.ts` — тесты закрытия/переоткрытия проходят. Доказательства: `.omo/evidence/task-16-domain-modules-impl.log`
  Коммит: Y | feat(months): implement close and reopen with correct lifecycle rules

- [ ] 17. Заменить DTO в контроллерах Months на Zod-схемы + добавить CloseMonthRequestSchema
  Что делать / НЕЛЬЗЯ делать: В `MonthsController` заменить `unknown` на `CreateMonthRequestSchema`, `UpdateIncomeRequestSchema`, `CloseMonthRequestSchema` (новая — с version), `ReopenMonthRequestSchema`. Добавить валидацию period (YYYY-MM). Зарегистрировать CloseMonthRequestSchema в `packages/types/src/schemas.ts`. НЕЛЬЗЯ оставлять `unknown`. НЕЛЬЗЯ забывать version для close.
  Параллелизация: Волна 3 | Заблокировано: 1,14 | Блокирует: 25
  Ссылки: packages/types/src/schemas.ts
  Критерий приёмки: Все DTO типизированы; swagger отображает схемы; CloseMonthRequestSchema существует с полем version.
  QA: `cd apps/api && pnpm build && pnpm typecheck` — 0 ошибок. Доказательства: `.omo/evidence/task-17-domain-modules-impl.log`
  Коммит: Y | refactor(months): replace unknown dto with zod schemas including close request

- [ ] 18. Обновить UI «Месяц» — дашборд и управление
  Что делать / НЕЛЬЗЯ делать: Обновить `apps/mobile/app/(tabs)/month.tsx` — показать доход, распределение, свободные средства, статус, список конвертов с балансами. Кнопки: «Создать следующий», «Закрыть», «Открыть повторно» (disabled если уже reopened). Быстрые действия: «Списать», «Перевести», «Скорректировать» (disabled в закрытом). Переключатель периода (месяц/год). НЕЛЬЗЯ показывать float для денег. НЕЛЬЗЯ показывать день — только месяц (AC-21).
  Параллелизация: Волна 3 | Заблокировано: 13 | Блокирует: 24,25,26
  Ссылки: SPECIFICATION.md строки 340-351 (дашборд), AC-21 (только месяц)
  Критерий приёмки: Дашборд отображает актуальные данные; кнопки реагируют на статус; быстрые действия disabled в закрытом месяце; переключатель работает; дата — только месяц.
  QA: `cd apps/mobile && pnpm typecheck` — 0 ошибок; компоненты рендерятся. Доказательства: `.omo/evidence/task-18-domain-modules-impl.log`
  Коммит: Y | feat(mobile): implement month dashboard with controls and month-only dates

- [ ] 19. Добавить интеграционные тесты Months API
  Что делать / НЕЛЬЗЯ делать: Supertest для всех маршрутов: GET, POST, PATCH income, POST close, POST reopen. Проверить: статусные переходы, optimistic locking (version), ошибки при нарушениях, re-close не промоутит draft, только один reopened, закрытие при непокрытых операциях разрешено. НЕЛЬЗЯ пропускать пограничные случаи.
  Параллелизация: Волна 3 | Заблокировано: 14,15,16,17 | Блокирует: none
  Ссылки: SPECIFICATION.md строки 465-470 (API-контракт)
  Критерий приёмки: Все маршруты покрыты; coverage ≥ 80%; version conflict, re-close, reopened uniqueness тестированы.
  QA: `cd apps/api && pnpm test -- months.integration.spec.ts` — все тесты проходят. Доказательства: `.omo/evidence/task-19-domain-modules-impl.log`
  Коммит: Y | test(months): add integration tests for lifecycle endpoints

- [ ] 20. Реализовать копирование распределения при создании месяца
  Что делать / НЕЛЬЗЯ делать: При создании нового месяца (Todo 14) — скопировать allocations из предыдущего как редактируемые значения. Если предыдущего нет — пустые. Копировать только для active конвертов (не archived). НЕЛЬЗЯ копировать в закрытый месяц. НЕЛЬЗЯ копировать archived конверты.
  Параллелизация: Волна 3 | Заблокировано: 14,15 | Блокирует: 27
  Ссылки: SPECIFICATION.md строка 356 (копирование плана), строка 293 (archived исключаются)
  Критерий приёмки: Новый месяц получает allocation-суммы предыдущего для active конвертов; их можно изменить; archived не копируются.
  QA: `cd apps/api && pnpm test -- months.service.spec.ts` — тест копирования проходит. Доказательства: `.omo/evidence/task-20-domain-modules-impl.log`
  Коммит: Y | feat(months): implement allocation copying from previous month

### Волна 4: Allocations (Распределение)

- [ ] 21. Реализовать сохранение распределения
  Что делать / НЕЛЬЗЯ делать: save() — проверить version, проверить статус не 'closed'. Принять Map<envelopeId, amountString>. Конвертировать в копейки. Валидировать Σ ≤ income. Если превышение → 422 ALLOCATION_EXCEEDS_INCOME с сообщением «Распределено на X ₽ больше дохода. Уменьшите суммы по конвертам.» (строка 368). Удалить старые allocations, создать новые только для active конвертов. Запустить пересчёт через `recalculateMonthAtomically`. Вернуть сводку + warnings. НЕЛЬЗЯ сохранять при превышении дохода. НЕЛЬЗЯ сохранять в закрытый месяц. НЕЛЬЗЯ сохранять для archived конвертов.
  Параллелизация: Волна 4 | Заблокировано: 8,10,11 | Блокирует: 28
  Ссылки: SPECIFICATION.md строки 352-363 (редактор), строка 368 (сообщение об ошибке)
  Критерий приёмки: Сумма 75000 при доходе 100000 → 200; сумма 100001 при доходе 100000 → 422 с точной суммой превышения; сохранение в закрытый → 409 MONTH_LOCKED; archived конверты исключены.
  QA: `cd apps/api && pnpm test -- allocations.service.spec.ts` — тесты проходят. Доказательства: `.omo/evidence/task-21-domain-modules-impl.log`
  Коммит: Y | feat(allocations): implement save with income validation and closed-month check

- [ ] 22. Заменить DTO в AllocationsController на Zod-схемы
  Что делать / НЕЛЬЗЯ делать: Заменить `unknown` на `SaveAllocationsRequestSchema` через `@UsePipes(new ZodValidationPipe(...))`. Добавить валидацию version. НЕЛЬЗЯ оставлять `unknown`.
  Параллелизация: Волна 4 | Заблокировано: 1,21 | Блокирует: 28
  Ссылки: packages/types/src/schemas.ts (SaveAllocationsRequestSchema)
  Критерий приёмки: DTO типизирован; swagger отображает схему.
  QA: `cd apps/api && pnpm build && pnpm typecheck` — 0 ошибок. Доказательства: `.omo/evidence/task-22-domain-modules-impl.log`
  Коммит: Y | refactor(allocations): replace unknown dto with zod schemas

- [ ] 23. Обновить UI редактор распределения
  Что делать / НЕЛЬЗЯ делать: Обновить экран «Месяц» (Todo 18) — добавить редактор распределения. Поле общего дохода + строка на каждый активный конверт. Внизу: итог распределения и свободные средства. Блокировка сохранения при превышении. НЕЛЬЗЯ показывать float. НЕЛЬЗЯ показывать archived конверты. НЕЛЬЗЯ показывать день — только месяц (AC-21).
  Параллелизация: Волна 4 | Заблокировано: 18 | Блокирует: 29
  Ссылки: SPECIFICATION.md строки 352-363 (редактор), AC-21 (только месяц)
  Критерий приёмки: Редактор показывает active конверты и суммы; превышение блокирует кнопку сохранения и показывает разницу; дата — только месяц.
  QA: `cd apps/mobile && pnpm typecheck` — 0 ошибок. Доказательства: `.omo/evidence/task-23-domain-modules-impl.log`
  Коммит: Y | feat(mobile): implement allocation editor with active envelopes only

- [ ] 24. Добавить интеграционные тесты Allocations API
  Что делать / НЕЛЬЗЯ делать: Supertest для PUT /api/months/:period/allocations. Проверить: успешное сохранение, превышение дохода (точное сообщение), version conflict, сохранение в закрытый месяц, сохранение для archived конверта. НЕЛЬЗЯ пропускать failure paths.
  Параллелизация: Волна 4 | Заблокировано: 21,22 | Блокирует: none
  Ссылки: SPECIFICATION.md строки 468 (API)
  Критерий приёмки: Coverage ≥ 80%; все failure paths покрыты; archived конверт тестирован.
  QA: `cd apps/api && pnpm test -- allocations.integration.spec.ts` — все тесты проходят. Доказательства: `.omo/evidence/task-24-domain-modules-impl.log`
  Коммит: Y | test(allocations): add integration tests for all endpoints

- [ ] 25. Добавить Reporting controller query parameters
  Что делать / НЕЛЬЗЯ делать: Добавить `@Query('period')` в `monthlyDashboard()` и `@Query('year')` в `yearlyAnalytics()`. Валидировать формат. По умолчанию: текущий месяц/год. Обновить swagger-декораторы. НЕЛЬЗЯ возвращать данные без фильтрации по периоду.
  Параллелизация: Волна 4 | Заблокировано: 17,22 | Блокирует: 32
  Ссылки: SPECIFICATION.md строки 476-477 (API)
  Критерий приёмки: GET /api/dashboard/monthly?period=2024-01 возвращает данные за январь; GET /api/analytics/yearly?year=2024 — за 2024 год.
  QA: `cd apps/api && pnpm test -- reporting.service.spec.ts` — тесты проходят. Доказательства: `.omo/evidence/task-25-domain-modules-impl.log`
  Коммит: Y | feat(reporting): add query parameters for period and year

### Волна 5: Operations (Операции)

- [ ] 26. Реализовать создание операции
  Что делать / НЕЛЬЗЯ делать: create() — проверить version, проверить статус не 'closed'. Определить тип (expense/transfer/adjustment/initial_balance). Для transfer: проверить source ≠ destination, проверить остаток source. Если transfer > balance → не сохранять исходную сумму; предложить перевести только доступную сумму (Todo 27). Для expense > balance → разрешить с подтверждением (непокрытая часть). Для adjustment '-' > balance → баланс = 0, непокрытая = разница. sequence_no = max + 1 в месяце (SELECT ... FOR UPDATE для предотвращения race condition). Создать Operation + Result через движок. Запустить пересчёт. Вернуть Operation + Result + сводку + warnings. НЕЛЬЗЯ сохранять transfer сверх остатка без подтверждения. НЕЛЬЗЯ использовать archived конверт. НЕЛЬЗЯ в закрытом месяце.
  Параллелизация: Волна 5 | Заблокировано: 8,10,11 | Блокирует: 30,31
  Ссылки: SPECIFICATION.md строки 297-328 (операции), строки 369-371 (сообщения), строка 453 (уникальность sequence_no)
  Критерий приёмки: Списание 3000 из 10000 → balance 7000; списание 15000 из 10000 → balance 0, непокрыто 5000; перевод 10000 из 6000 → предложено 6000 (не сохраняет 10000); отрицательная корректировка 15000 при 10000 → balance 0, непокрыто 5000; archived конверт → 409; закрытый месяц → 409 MONTH_LOCKED; concurrent creation — sequence_no уникальны.
  QA: `cd apps/api && pnpm test -- operations.service.spec.ts` — тесты создания проходят. Доказательства: `.omo/evidence/task-26-domain-modules-impl.log`
  Коммит: Y | feat(operations): implement creation with type-specific validation and race-safe sequence

- [ ] 27. Реализовать редактирование и удаление операции
  Что делать / НЕЛЬЗЯ делать: update() — проверить version, проверить статус open/reopened/draft. Не менять sequence_no. Проверить новые значения (transfer не > balance без подтверждения). Удалить старый Result, создать новый через движок, запустить пересчёт. remove() — проверить version, проверить статус open/reopened/draft. Удалить Operation + Result, запустить пересчёт. sequence_no остаётся с разрывом. НЕЛЬЗЯ редактировать в closed. НЕЛЬЗЯ менять sequence_no. НЕЛЬЗЯ удалять в closed.
  Параллелизация: Волна 5 | Заблокировано: 26 | Блокирует: 30,31
  Ссылки: SPECIFICATION.md строки 313-318 (редактирование), строки 195 (sequence_no стабилен)
  Критерий приёмки: Редактирование первой операции не меняет sequence_no; последующие результаты пересчитываются; удаление запускает пересчёт; редактирование в closed → 409; удаление в closed → 409.
  QA: `cd apps/api && pnpm test -- operations.service.spec.ts` — тесты редактирования/удаления проходят. Доказательства: `.omo/evidence/task-27-domain-modules-impl.log`
  Коммит: Y | feat(operations): implement update and delete with stable sequence and closed-month check

- [ ] 28. Заменить DTO в OperationsController на Zod-схемы
  Что делать / НЕЛЬЗЯ делать: Заменить `unknown` на `CreateOperationRequestSchema`, `UpdateOperationRequestSchema` через `@UsePipes(new ZodValidationPipe(...))`. Добавить валидацию типов и сумм. НЕЛЬЗЯ оставлять `unknown`.
  Параллелизация: Волна 5 | Заблокировано: 1,26 | Блокирует: 33
  Ссылки: packages/types/src/schemas.ts
  Критерий приёмки: Все DTO типизированы; swagger отображает схемы.
  QA: `cd apps/api && pnpm build && pnpm typecheck` — 0 ошибок. Доказательства: `.omo/evidence/task-28-domain-modules-impl.log`
  Коммит: Y | refactor(operations): replace unknown dto with zod schemas

- [ ] 29. Обновить UI «История» и формы операций
  Что делать / НЕЛЬЗЯ делать: Обновить `apps/mobile/app/(tabs)/history.tsx` — список операций с фильтрами (по месяцу, конверту, типу). Для каждой строки: сумма, покрыто, непокрыто, статус. Добавить модальные формы: «Списать», «Перевести», «Скорректировать». Для перевода: если сумма > остаток — показать предупреждение с предложением доступной суммы. НЕЛЬЗЯ показывать float. НЕЛЬЗЯ показывать день — только месяц (AC-21). НЕЛЬЗЯ показывать archived конверты в выборе.
  Параллелизация: Волна 5 | Заблокировано: 18,23 | Блокирует: 34
  Ссылки: SPECIFICATION.md строки 323-328 (история), строки 350-351 (быстрые действия), AC-21
  Критерий приёмки: История показывает операции с фильтрами; формы создают операции с валидацией; непокрытые суммы выделены; перевод > остатка показывает предупреждение; дата — только месяц; archived не в списке.
  QA: `cd apps/mobile && pnpm typecheck` — 0 ошибок. Доказательства: `.omo/evidence/task-29-domain-modules-impl.log`
  Коммит: Y | feat(mobile): implement history screen and operation forms with month-only dates

- [ ] 30. Добавить интеграционные тесты Operations API
  Что делать / НЕЛЬЗЯ делать: Supertest для GET/POST /api/operations, PATCH/DELETE /api/operations/:id. Проверить: все типы операций, непокрытые суммы, version conflict, редактирование в closed, удаление в closed, sequence_no стабилен, transfer > balance блокируется, archived конверт блокируется, concurrent sequence_no уникальны. НЕЛЬЗЯ пропускать failure paths.
  Параллелизация: Волна 5 | Заблокировано: 26,27,28 | Блокирует: none
  Ссылки: SPECIFICATION.md строки 474-475 (API)
  Критерий приёмки: Coverage ≥ 80%; все типы операций и failure paths покрыты.
  QA: `cd apps/api && pnpm test -- operations.integration.spec.ts` — все тесты проходят. Доказательства: `.omo/evidence/task-30-domain-modules-impl.log`
  Коммит: Y | test(operations): add integration tests for all endpoints

- [ ] 31. Обновить UI «Аналитика»
  Что делать / НЕЛЬЗЯ делать: Обновить `apps/mobile/app/(tabs)/analytics.tsx` — 3 секции: доход/распределение/свободные (группированная диаграмма + таблица по 12 месяцам), балансы конвертов (выбор конвертов для графика, таблица конверт × месяц), непокрытые операции (таблица по месяцам с разбивкой: списания, переводы, корректировки). Переход в детализацию месяца. Выбор года. НЕЛЬЗЯ показывать float. НЕЛЬЗЯ показывать archived конверты по умолчанию (фильтр). НЕЛЬЗЯ показывать день — только месяц (AC-21).
  Параллелизация: Волна 5 | Заблокировано: 18,23,25 | Блокирует: 34
  Ссылки: SPECIFICATION.md строки 375-403 (аналитика), строки 337 (экран)
  Критерий приёмки: Аналитика показывает 3 отчёта; выбор года работает; переход в месяц работает; archived фильтруются; дата — только месяц.
  QA: `cd apps/mobile && pnpm typecheck` — 0 ошибок. Доказательства: `.omo/evidence/task-31-domain-modules-impl.log`
  Коммит: Y | feat(mobile): implement analytics screen with 3 reports and year selector

### Волна 6: Reporting (Отчётность)

- [ ] 32. Реализовать месячный дашборд
  Что делать / НЕЛЬЗЯ делать: monthlyDashboard(period) — для указанного месяца вернуть: доход, распределено, свободно, корректировки, непокрытые суммы с разбивкой по типам (expense/transfer/adjustment), список конвертов с остатками (из snapshot). Только active конверты по умолчанию (опция показать archived). НЕЛЬЗЯ вычислять на лету — читать из snapshot.
  Параллелизация: Волна 6 | Заблокировано: 8,25 | Блокирует: 35
  Ссылки: SPECIFICATION.md строки 340-351 (дашборд), строки 476 (API)
  Критерий приёмки: GET /api/dashboard/monthly?period=2024-01 возвращает полную сводку с конвертами и предупреждениями.
  QA: `cd apps/api && pnpm test -- reporting.service.spec.ts` — тесты дашборда проходят. Доказательства: `.omo/evidence/task-32-domain-modules-impl.log`
  Коммит: Y | feat(reporting): implement monthly dashboard with snapshot data

- [ ] 33. Реализовать годовую аналитику (3 отчёта)
  Что делать / НЕЛЬЗЯ делать: yearlyAnalytics(year) — вернуть: 1) доход/распределение/свободные по 12 месяцам (группированная), 2) балансы каждого конверта по месяцам (таблица конверт × месяц, только active по умолчанию), 3) непокрытые операции по месяцам (разбивка: списания, переводы, корректировки). Всё из snapshot. НЕЛЬЗЯ вычислять на лету.
  Параллелизация: Волна 6 | Заблокировано: 8,25 | Блокирует: 35
  Ссылки: SPECIFICATION.md строки 375-403 (аналитика), строки 477 (API)
  Критерий приёмки: GET /api/analytics/yearly?year=2024 возвращает 3 отчёта с данными за 12 месяцев.
  QA: `cd apps/api && pnpm test -- reporting.service.spec.ts` — тесты аналитики проходят. Доказательства: `.omo/evidence/task-33-domain-modules-impl.log`
  Коммит: Y | feat(reporting): implement yearly analytics with 3 reports

- [ ] 34. Добавить интеграционные тесты Reporting API
  Что делать / НЕЛЬЗЯ делать: Supertest для GET /api/dashboard/monthly и GET /api/analytics/yearly. Проверить: наличие всех полей, корректность данных после мутаций, пустой год, archived конверты фильтруются. НЕЛЬЗЯ пропускать пограничные случаи.
  Параллелизация: Волна 6 | Заблокировано: 32,33 | Блокирует: none
  Ссылки: SPECIFICATION.md строки 476-477 (API)
  Критерий приёмки: Coverage ≥ 80%; данные корректны после каскадного пересчёта; archived фильтрация работает.
  QA: `cd apps/api && pnpm test -- reporting.integration.spec.ts` — все тесты проходят. Доказательства: `.omo/evidence/task-34-domain-modules-impl.log`
  Коммит: Y | test(reporting): add integration tests for dashboard and analytics

### Волна 7: Интеграция и финальная верификация

- [ ] 35. Обновить AppModule и проверить end-to-end API
  Что делать / НЕЛЬЗЯ делать: Убедиться, что все сервисы корректно зарегистрированы в AppModule. Проверить полный цикл: создать месяц → создать конверты → распределить доход → создать операции → закрыть месяц → открыть повторно → проверить пересчёт. НЕЛЬЗЯ оставлять незарегистрированные сервисы. НЕЛЬЗЯ оставлять dead code (ValidationPipe в main.ts).
  Параллелизация: Волна 7 | Заблокировано: все выше | Блокирует: none
  Ссылки: `apps/api/src/app.module.ts`, `apps/api/src/main.ts`
  Критерий приёмки: Полный цикл проходит через API без ошибок; все данные консистентны; dead code удалён.
  QA: `cd apps/api && pnpm test` — все тесты (unit + integration) проходят. Доказательства: `.omo/evidence/task-35-domain-modules-impl.log`
  Коммит: Y | chore(api): verify full e2e cycle and remove dead code

- [ ] 36. Проверить AC-01..AC-22 (критерии приёмки MVP)
  Что делать / НЕЛЬЗЯ делать: Пройти все 22 acceptance criteria из SPECIFICATION.md строки 541-565. Для каждого: написать автоматизируемый тест или скрипт (curl/bash), описать шаги, ожидаемый результат, фактический результат. НЕЛЬЗЯ пропускать AC. НЕЛЬЗЯ подделывать результаты.
  Параллелизация: Волна 7 | Заблокировано: все выше | Блокирует: none
  Ссылки: SPECIFICATION.md строки 537-565 (AC)
  Критерий приёмки: Все 22 AC проверены; задокументированы результаты (pass/fail + notes); AC-22 (сохранение после перезапуска) проверен через Docker restart.
  QA: Автоматизированные скрипты/curl + ручная проверка только для UI-визуальных аспектов (отмечено отдельно). Доказательства: `.omo/evidence/task-36-domain-modules-impl-ac-checklist.md`
  Коммит: N | (только верификация)

- [ ] 37. Проверить Docker Compose end-to-end
  Что делать / НЕЛЬЗЯ делать: Запустить `docker compose up -d --build`. Проверить: PostgreSQL стартует, API стартует, swagger доступен, фронтенд собирается. Создать тестовые данные через API. Перезапустить контейнер (`docker compose down && docker compose up -d`). Проверить, что данные сохранились (AC-22). Проверить persistent volume. НЕЛЬЗЯ требовать production-конфигурации.
  Параллелизация: Волна 7 | Заблокировано: все выше | Блокирует: none
  Ссылки: SPECIFICATION.md строка 572 (запуск одной командой), AC-22 (сохранение)
  Критерий приёмки: `docker compose up -d --build && sleep 10 && curl -sf http://localhost:3000/api/v1/health && curl -sf http://localhost:3000/api/swagger.json` → 0; данные сохраняются после restart.
  QA: `docker compose up -d --build && curl POST test data && docker compose down && docker compose up -d && curl GET verify data && docker compose down`. Доказательства: `.omo/evidence/task-37-domain-modules-impl.log`
  Коммит: N | (только верификация)

- [ ] 38. Проверить метрики coverage и lint
  Что делать / НЕЛЬЗЯ делать: Проверить: coverage движка ≥ 95%, интеграционные ≥ 80%, все пакеты typecheck = 0, lint = 0 (или только pre-existing). Проверить отсутствие `unknown` в контроллерах. Проверить отсутствие float-арифметики. НЕЛЬЗЯ пропускать проверку.
  Параллелизация: Волна 7 | Заблокировано: все выше | Блокирует: none
  Ссылки: Критерии успеха
  Критерий приёмки: Coverage в норме; typecheck/lint чистые; все DTO типизированы; деньги в копейках.
  QA: `cd apps/api && pnpm test -- --coverage && pnpm typecheck && pnpm lint`. Доказательства: `.omo/evidence/task-38-domain-modules-impl-coverage.html`
  Коммит: N | (только верификация)

## Финальная волна верификации
> Запускается параллельно после ВСЕХ todo. ВСЕ должны ПРОЙТИ. Показать результаты и ждать явного подтверждения пользователя перед объявлением завершения.
- [ ] F1. Аудит соответствия плану
- [ ] F2. Ревью качества кода
- [ ] F3. Реальная ручная QA (UI-визуальные аспекты, отмеченные в todo 36)
- [ ] F4. Соответствие охвату

## Стратегия коммитов
- Атомарные коммиты на todo (или малые группы тесно связанных todo)
- Формат conventional commits: `type(scope): description` на русском
- Нет коммитов во время задач только верификации (F-wave, задачи 36-38)
- Результаты финальной волны верификации прикрепляются как доказательства, не коммитятся
- НЕ коммитить после завершения плана, пока пользователь явно не попросит

## Критерии успеха
- [ ] `pnpm install` успешен из корня
- [ ] `pnpm build` успешен для всех пакетов и приложений
- [ ] `pnpm test` успешен (unit + integration) для apps/api
- [ ] `pnpm typecheck` успешен для всех пакетов
- [ ] `pnpm lint` успешен (или показывает только pre-existing проблемы)
- [ ] `docker compose up -d --build` запускает все сервисы
- [ ] API отвечает `/api/v1/health` кодом 200
- [ ] Swagger UI доступен и показывает типизированные схемы
- [ ] Все 14+ API-маршрутов возвращают реальные данные (не заглушки)
- [ ] Фронтенд показывает все 4 раздела с реальными данными
- [ ] Все AC-01..AC-22 проверены и задокументированы
- [ ] AC-22 (сохранение после перезапуска) проверен через Docker restart
- [ ] Calculation Engine имеет coverage ≥ 95%
- [ ] Интеграционные тесты покрывают все failure paths (422, 409)
- [ ] Нет `unknown` DTO в контроллерах — все типизированы Zod
- [ ] Нет float-арифметики для денег — только целые копейки
- [ ] Все мутации атомарны (source + recalculation в одной транзакции)
- [ ] Нет секретов в коммитах
