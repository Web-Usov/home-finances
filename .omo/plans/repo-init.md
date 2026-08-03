# repo-init — План работ

## TL;DR (Для людей)

**Что вы получите:** Полный скелет монорепозитория с бэкендом NestJS (Prisma + PostgreSQL), фронтендом Expo (React Native Web + NativeWind), общими пакетами для типов и конфигов, Docker Compose для локальной разработки и CI/CD pipeline. Бэкенд получит заглушки всех API-эндпоинтов по спеке, фронтенд — навигацию и экраны для всех 4 разделов.

**Почему этот подход:** Мы выбрали Expo + React Native Web вместо чистого React web, чтобы обеспечить будущие мобильные сборки по вашему стеку, сохраняя web как основную цель MVP. NestJS с Fastify даёт модульную доменную структуру, которую требует расчётный движок спеки.

**Что НЕ будет сделано:** Реальная бизнес-логика, финансовые расчёты или запросы к базе данных. Нет реальной auth-системы (по спеке MVP). Нет нативных мобильных сборок пока (EAS настроен как заглушка). Нет деплоя в production.

**Трудоёмкость:** Большая
**Риск:** Средний — Expo в монорепозиториях с pnpm может давать проблемы с резолвом зависимостей; адаптер Fastify для NestJS требует внимательной настройки
**Решения для проверки:** 1) Expo + RN Web вместо чистого Next.js/React — подтвердите, что это намеренно для будущего mobile. 2) Нет auth в MVP — Clerk пропущен по спеке. 3) Orval для генерации API — подтвердите, что хотите сгенерированные клиенты вместо ручных.

Следующий шаг: Одобрите план, затем запустите `/start-work` для начала выполнения. Полное описание выполнения ниже.

---

> TL;DR (машина): <1 строка — трудоёмкость, риск, результаты

## Охват
### Обязательно
- Корневая конфигурация монорепо (pnpm workspaces + Turborepo)
- Docker Compose с PostgreSQL
- Бэкенд NestJS с адаптером Fastify, ORM Prisma, OpenAPI/Swagger
- Схема Prisma точно соответствует модели данных SPECIFICATION.md
- Все API-эндпоинты-заглушки по SPECIFICATION.md строки 461-477
- Скелет доменных модулей (Months, Envelopes, Allocations, Operations, CalculationEngine, Reporting)
- Фронтенд Expo + React Native Web с Expo Router
- Настроен NativeWind v4
- TanStack Query, Zustand, React Hook Form + Zod
- Конфигурация Orval для генерации API-клиента
- Общие пакеты: tsconfig, eslint-config, types (Zod-схемы + TS-типы)
- GitHub Actions CI workflow
- EAS Build конфигурация-заглушка
- Шаблоны окружения (.env.example для всех сервисов)
- Корневой README с инструкциями по установке

### Категорически нельзя (ограничители, anti-slop, границы охвата)
- НЕТ реализации бизнес-логики (расчётный движок, финансовые формулы)
- НЕТ реальных запросов к базе в контроллерах/сервисах (только заглушки)
- НЕТ системы аутентификации/авторизации (по спеке MVP строка 417, 582)
- НЕТ интеграции Clerk (отложено на post-MVP)
- НЕТ нативных мобильных сборок в CI (EAS — только заглушка)
- НЕТ production-конфигурации деплоя
- НЕТ e2e-тестов с реальным браузером (вне скопа скелета)
- НЕТ функций backup/import/export (спека строка 584)
- НЕТ банковских интеграций (спека строка 588)

## Стратегия верификации
> Нулевое вмешательство человека — вся верификация выполняется агентом.
- Решение по тестам: tests-after + Jest (бэкенд), none для скелета фронтенда (lint + typecheck достаточно)
- Доказательства: .omo/evidence/task-<N>-repo-init.<ext>

## Стратегия выполнения
### Параллельные волны выполнения
> Целевой показатель: 5-8 todo на волну. Меньше 3 (кроме финальной) — значит, вы плохо разбили.

Волна 1 (3 задачи): Корневая инфраструктура — нет зависимостей, можно начать сразу
Волна 2 (3 задачи): Общие пакеты — зависит от Волны 1, можно параллельно с началом Волны 3
Волна 3 (6 задач): Скелет бэкенда — зависит от Волн 1-2
Волна 4 (6 задач): Скелет фронтенда — зависит от Волн 1-2, частично от Волны 3 для Orval
Волна 5 (3 задачи): CI/CD — зависит от Волн 3-4
Волна 6 (3 задачи): Финальная верификация — зависит от всех выше

### Матрица зависимостей
| Todo | Зависит от | Блокирует | Можно параллельно с |
| --- | --- | --- | --- |
| 1 | none | 2, 3, 4, 6, 7, 9, 13, 21 | none |
| 2 | none | none | 1, 3 |
| 3 | none | 9, 23 | 1, 2 |
| 4 | 1 | 7, 9, 13 | 5, 6 |
| 5 | 1 | 7, 9, 13 | 4, 6 |
| 6 | 1 | 17 | 4, 5 |
| 7 | 1, 4 | 8 | 13 |
| 8 | 7 | 9 | none |
| 9 | 8, 3 | 10 | none |
| 10 | 9 | 11 | none |
| 11 | 10 | 12, 17 | none |
| 12 | 11 | 19, 23 | none |
| 13 | 1, 4 | 14 | 7 |
| 14 | 13 | 15 | none |
| 15 | 14 | 16 | none |
| 16 | 15 | 17 | none |
| 17 | 11, 6 | 18 | none |
| 18 | 17 | 19, 20 | none |
| 19 | 12, 18 | none | 20, 21 |
| 20 | 18 | none | 19, 21 |
| 21 | 1, 7, 13 | none | 19, 20 |
| 22 | all | none | 23, 24 |
| 23 | all | none | 22, 24 |
| 24 | all | none | 22, 23 |

## Todos
> Реализация + Тест = ОДИН todo. Никогда не разделять.

### Волна 1: Корневая инфраструктура
- [ ] 1. Инициализировать корневую конфигурацию монорепо
  Что делать / НЕЛЬЗЯ делать: Создать root package.json с pnpm workspaces и Turborepo. НЕЛЬЗЯ добавлять ненужные root-зависимости.
  Параллелизация: Волна 1 | Заблокировано: none | Блокирует: 2, 3, 4
  Ссылки: SPECIFICATION.md строки 405-432 (архитектура), SPECIFICATION.md строки 435-446 (модель данных)
  Критерий приёмки: `pnpm --version` работает, `cat package.json` показывает массив workspaces, `cat pnpm-workspace.yaml` существует
  QA: Запустить `pnpm install` в корне → завершается с 0. Доказательства .omo/evidence/task-1-repo-init.log
  Коммит: Y | chore(repo): initialize pnpm workspace and turborepo root

- [ ] 2. Добавить корневые инструменты и документацию
  Что делать / НЕЛЬЗЯ делать: Создать .gitignore (node_modules, .env, dist, build), .nvmrc (node 20), .editorconfig, корневой README.md с инструкциями. НЕЛЬЗЯ коммитить секреты или .env файлы.
  Параллелизация: Волна 1 | Заблокировано: none | Блокирует: none
  Ссылки: SPECIFICATION.md строки 567-576 (definition of done), SPECIFICATION.md строки 598-603 (deployment decisions)
  Критерий приёмки: `test -f .gitignore && test -f .nvmrc && test -f README.md`
  QA: Проверить отсутствие node_modules или .env в git tracking через `git ls-files | grep -E "node_modules|\.env"` → пусто. Доказательства .omo/evidence/task-2-repo-init.log
  Коммит: Y | docs(repo): add root tooling and readme

- [ ] 3. Создать инфраструктуру Docker Compose
  Что делать / НЕЛЬЗЯ делать: Создать docker-compose.yml с сервисом PostgreSQL 16 (persistent volume), опционально Redis. НЕЛЬЗЯ создавать Dockerfiles бэкенда/приложений сейчас. Использовать .env.example для всех конфигурируемых значений.
  Параллелизация: Волна 1 | Заблокировано: none | Блокирует: 8
  Ссылки: SPECIFICATION.md строки 405-416 (архитектура, деплой), SPECIFICATION.md строки 505-511 (надёжность)
  Критерий приёмки: `docker compose config` завершается с 0, `cat docker-compose.yml` показывает сервис postgres с volume
  QA: Запустить `docker compose up -d` → postgres healthy. Доказательства .omo/evidence/task-3-repo-init.log
  Коммит: Y | chore(infra): add docker compose with postgresql

### Волна 2: Общие пакеты
- [ ] 4. Создать общие конфигурации TypeScript
  Что делать / НЕЛЬЗЯ делать: Создать packages/tsconfig с пресетами base, node, react-native. НЕЛЬЗЯ дублировать конфиги в каждом приложении.
  Параллелизация: Волна 2 | Заблокировано: 1 | Блокирует: 6, 9
  Ссылки: NestJS требует strict TS, Expo требует свой пресет
  Критерий приёмки: `test -f packages/tsconfig/base.json && test -f packages/tsconfig/react-native.json`
  QA: Валидировать JSON-синтаксис через `node -e "JSON.parse(require('fs').readFileSync('packages/tsconfig/base.json'))"`. Доказательства .omo/evidence/task-4-repo-init.log
  Коммит: Y | chore(config): add shared typescript configurations

- [ ] 5. Создать общую конфигурацию ESLint
  Что делать / НЕЛЬЗЯ делать: Создать packages/eslint-config с рекомендуемыми правилами для TypeScript, React, React Native. НЕЛЬЗЯ быть излишне строгим, чтобы избежать начального трения.
  Параллелизация: Волна 2 | Заблокировано: 1 | Блокирует: 6, 9
  Ссылки: Стандартный линтинг для монорепо
  Критерий приёмки: `test -f packages/eslint-config/index.js`
  QA: `node -e "require('./packages/eslint-config')"` завершается с 0. Доказательства .omo/evidence/task-5-repo-init.log
  Коммит: Y | chore(config): add shared eslint configuration

- [ ] 6. Создать общий пакет типов
  Что делать / НЕЛЬЗЯ делать: Создать packages/types с Zod-схемами и TypeScript-типами, выведенными из SPECIFICATION.md сущностей: BudgetMonth, Envelope, Allocation, Operation, OperationResult, EnvelopeMonthSnapshot, AppSettings. НЕЛЬЗЯ реализовывать бизнес-логику здесь — только типы и валидационные схемы.
  Параллелизация: Волна 2 | Заблокировано: 1 | Блокирует: 8, 14
  Ссылки: SPECIFICATION.md строки 437-446 (модель данных), SPECIFICATION.md строки 449-459 (ограничения)
  Критерий приёмки: `test -f packages/types/src/schemas.ts && test -f packages/types/src/entities.ts`
  QA: `cd packages/types && pnpm build` завершается с 0. Доказательства .omo/evidence/task-6-repo-init.log
  Коммит: Y | feat(types): add domain entity types and zod schemas

### Волна 3: Бэкенд API (NestJS + Fastify)
- [ ] 7. Создать скелет NestJS-приложения
  Что делать / НЕЛЬЗЯ делать: Создать apps/api по паттерну NestJS CLI, адаптер Fastify (@nestjs/platform-fastify), настройка Swagger/OpenAPI. НЕЛЬЗЯ реализовывать полные контроллеры пока. Должен включать health check эндпоинт.
  Параллелизация: Волна 3 | Заблокировано: 1, 4 | Блокирует: 8
  Ссылки: SPECIFICATION.md строки 461-490 (API-контракт)
  Критерий приёмки: `test -d apps/api/src && test -f apps/api/src/main.ts`
  QA: `cd apps/api && pnpm install && pnpm build` завершается с 0. Доказательства .omo/evidence/task-7-repo-init.log
  Коммит: Y | feat(api): scaffold nestjs with fastify and swagger

- [ ] 8. Настроить Prisma ORM и схему базы данных
  Что делать / НЕЛЬЗЯ делать: Инициализировать Prisma в apps/api/prisma. Создать schema.prisma точно по SPECIFICATION.md сущностям: BudgetMonth, Envelope, Allocation, Operation, OperationResult, EnvelopeMonthSnapshot, AppSettings. НЕЛЬЗЯ создавать миграции сейчас — только схема. Использовать UUID для ID и Int для копеек (minor units).
  Параллелизация: Волна 3 | Заблокировано: 7 | Блокирует: 9
  Ссылки: SPECIFICATION.md строки 437-446 (модель данных), SPECIFICATION.md строки 449-459 (ограничения)
  Критерий приёмки: `test -f apps/api/prisma/schema.prisma`, схема включает все 7 сущностей
  QA: `cd apps/api && npx prisma validate` завершается с 0. Доказательства .omo/evidence/task-8-repo-init.log
  Коммит: Y | feat(api): add prisma schema for budget domain

- [ ] 9. Создать миграцию базы данных и сид-скрипт
  Что делать / НЕЛЬЗЯ делать: Запустить `prisma migrate dev` для создания начальной миграции. Создать сид-скрипт с базовыми app_settings (RUB, ru-RU). Должен быть идемпотентным.
  Параллелизация: Волна 3 | Заблокировано: 8, 3 | Блокирует: 10
  Ссылки: SPECIFICATION.md строки 79-85 (технические допущения), SPECIFICATION.md строки 505-511 (надёжность)
  Критерий приёмки: `test -d apps/api/prisma/migrations && test -f apps/api/prisma/seed.ts`
  QA: С запущенной БД: `cd apps/api && npx prisma migrate reset --force` завершается с 0, `npx prisma db seed` завершается с 0, затем `npx prisma studio` стартует. Доказательства .omo/evidence/task-9-repo-init.log
  Коммит: Y | feat(api): add initial migration and seed script

- [ ] 10. Реализовать структуру доменных модулей
  Что делать / НЕЛЬЗЯ делать: Создать NestJS модули: Months, Envelopes, Allocations, Operations, CalculationEngine, Reporting. Создать базовые сервисы и контроллеры-заглушки для каждого. НЕЛЬЗЯ реализовывать полную бизнес-логику — только скелет модулей с TODO-комментариями, ссылающимися на разделы спеки. Соединить все модули в AppModule.
  Параллелизация: Волна 3 | Заблокировано: 9 | Блокирует: 11
  Ссылки: SPECIFICATION.md строки 419-432 (логические модули), SPECIFICATION.md строки 461-490 (API-контракт)
  Критерий приёмки: `ls apps/api/src/modules` показывает 6 директорий
  QA: `cd apps/api && pnpm build` завершается с 0. Доказательства .omo/evidence/task-10-repo-init.log
  Коммит: Y | feat(api): add domain module scaffolding

- [ ] 11. Реализовать заглушки REST API-эндпоинтов
  Что делать / НЕЛЬЗЯ делать: Реализовать все маршруты из SPECIFICATION.md строки 461-477 как контроллеры-заглушки, возвращающие 501 Not Implemented или mock-данные. Использовать общий пакет типов для DTO. Включить декораторы Swagger.
  Параллелизация: Волна 3 | Заблокировано: 10 | Блокирует: 14
  Ссылки: SPECIFICATION.md строки 461-490 (API-контракт)
  Критерий приёмки: `grep -r "@Controller\|@Get\|@Post\|@Patch\|@Put\|@Delete" apps/api/src/modules` показывает все маршруты
  QA: Запустить API, выполнить `curl http://localhost:3000/api/months` → возвращает 200 или 501 с JSON. Доказательства .omo/evidence/task-11-repo-init.log
  Коммит: Y | feat(api): add rest api endpoint stubs

- [ ] 12. Добавить Dockerfile бэкенда и интеграцию с compose
  Что делать / НЕЛЬЗЯ делать: Создать apps/api/Dockerfile (многоступенчатый: deps → build → production). Обновить docker-compose.yml для включения api-сервиса. НЕЛЬЗЯ включать фронтенд в бэкенд-контейнер.
  Параллелизация: Волна 3 | Заблокировано: 11 | Блокирует: 17
  Ссылки: SPECIFICATION.md строка 572 (запуск Docker Compose)
  Критерий приёмки: `test -f apps/api/Dockerfile`
  QA: `docker build -f apps/api/Dockerfile apps/api` успешен. Доказательства .omo/evidence/task-12-repo-init.log
  Коммит: Y | chore(api): add dockerfile and compose service

### Волна 4: Фронтенд (Expo + React Native Web)
- [ ] 13. Инициализировать Expo-приложение
  Что делать / НЕЛЬЗЯ делать: Создать apps/mobile с Expo SDK 51, TypeScript, Expo Router. Настроить для web-поддержки (react-native-web). НЕЛЬЗЯ делать eject из Expo managed workflow.
  Параллелизация: Волна 4 | Заблокировано: 1, 4 | Блокирует: 14
  Ссылки: Документация Expo для монорепо с pnpm
  Критерий приёмки: `test -f apps/mobile/package.json && test -f apps/mobile/app.json`
  QA: `cd apps/mobile && pnpm install` завершается с 0. Доказательства .omo/evidence/task-13-repo-init.log
  Коммит: Y | feat(mobile): initialize expo with typescript and router

- [ ] 14. Настроить NativeWind и стилизацию
  Что делать / НЕЛЬЗЯ делать: Настроить NativeWind v4 в apps/mobile с конфигурацией Tailwind CSS. Создать файл global CSS. Добавить базовую конфигурацию цветовой темы. Использовать class-based стилизацию (не StyleSheet.create).
  Параллелизация: Волна 4 | Заблокировано: 13 | Блокирует: 15
  Ссылки: Документация NativeWind stable, SPECIFICATION.md строки 513-524 (UI-требования)
  Критерий приёмки: `test -f apps/mobile/tailwind.config.js && test -f apps/mobile/global.css`
  QA: `cd apps/mobile && pnpm expo start --web` стартует без ошибок NativeWind. Доказательства .omo/evidence/task-14-repo-init.log
  Коммит: Y | feat(mobile): add nativewind and tailwind configuration

- [ ] 15. Настроить TanStack Query и Zustand
  Что делать / НЕЛЬЗЯ делать: Добавить провайдер TanStack Query с базовой конфигурацией. Создать структуру Zustand-сторов (monthStore, envelopeStore, uiStore). НЕЛЬЗЯ реализовывать полную логику состояния пока — только скелет с типами.
  Параллелизация: Волна 4 | Заблокировано: 14 | Блокирует: 16
  Ссылки: SPECIFICATION.md строки 100-108 (ежемесячный workflow), SPECIFICATION.md строки 329-339 (экраны)
  Критерий приёмки: `test -d apps/mobile/src/stores && test -f apps/mobile/src/providers/QueryProvider.tsx`
  QA: `cd apps/mobile && pnpm build:web` завершается с 0. Доказательства .omo/evidence/task-15-repo-init.log
  Коммит: Y | feat(mobile): add tanstack query and zustand stores

- [ ] 16. Настроить React Hook Form с Zod
  Что делать / НЕЛЬЗЯ делать: Добавить react-hook-form и zod resolver. Создать повторно используемый компонент FormInput. Создать пример схемы формы (например, логин или форма дохода). Использовать общий пакет типов где применимо.
  Параллелизация: Волна 4 | Заблокировано: 15 | Блокирует: 17
  Ссылки: SPECIFICATION.md строки 350-363 (editor forms), SPECIFICATION.md строки 364-374 (validation messages)
  Критерий приёмки: `test -f apps/mobile/src/components/FormInput.tsx`
  QA: `cd apps/mobile && pnpm tsc --noEmit` завершается с 0. Доказательства .omo/evidence/task-16-repo-init.log
  Коммит: Y | feat(mobile): add react hook form with zod validation

- [ ] 17. Настроить Orval для генерации API-клиента
  Что делать / НЕЛЬЗЯ делать: Настроить Orval в apps/mobile для генерации API-клиента из OpenAPI-спеки бэкенда. Создать orval.config.js, указывающий на swagger JSON apps/api. НЕЛЬЗЯ требовать запущенный бэкенд для генерации — использовать статическую спеку или mock. Добавить сгенерированный клиент в .gitignore.
  Параллелизация: Волна 4 | Заблокировано: 11, 6 | Блокирует: 18
  Ссылки: SPECIFICATION.md строки 461-490 (API-контракт)
  Критерий приёмки: `test -f apps/mobile/orval.config.js`
  QA: С запущенным бэкендом и доступной спекой: `cd apps/mobile && pnpm orval` завершается с 0 и создаёт файлы. Доказательства .omo/evidence/task-17-repo-init.log
  Коммит: Y | feat(mobile): add orval configuration for api client generation

- [ ] 18. Создать навигацию и заглушки экранов
  Что делать / НЕЛЬЗЯ делать: Реализовать bottom tab navigation (mobile) / side navigation (web) с 4 вкладками: Месяц (дашборд), История, Аналитика, Конверты. Создать компоненты-заглушки экранов для каждого. Использовать файловую маршрутизацию Expo Router. Обрабатывать различия web-layout через responsive design (не отдельное web-приложение).
  Параллелизация: Волна 4 | Заблокировано: 17 | Блокирует: none
  Ссылки: SPECIFICATION.md строки 329-339 (экраны и навигация)
  Критерий приёмки: `ls apps/mobile/app` показывает файлы маршрутов для всех 4 разделов
  QA: `cd apps/mobile && pnpm expo start --web` → web-интерфейс загружается, навигация видна, без крашей. Доказательства .omo/evidence/task-18-repo-init.log
  Коммит: Y | feat(mobile): add basic navigation and screen stubs

### Волна 5: CI/CD и деплой
- [ ] 19. Добавить GitHub Actions CI workflow
  Что делать / НЕЛЬЗЯ делать: Создать .github/workflows/ci.yml с джобами: lint (все пакеты), typecheck (все пакеты), build (бэкенд + фронтенд), test (бэкенд). Использовать pnpm cache. НЕЛЬЗЯ включать деплой в production.
  Параллелизация: Волна 5 | Заблокировано: 12, 18 | Блокирует: none
  Ссылки: SPECIFICATION.md строки 572-576 (definition of done)
  Критерий приёмки: `test -f .github/workflows/ci.yml`
  QA: Валидировать YAML через `actionlint` или `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`. Доказательства .omo/evidence/task-19-repo-init.log
  Коммит: Y | chore(ci): add github actions workflow

- [ ] 20. Добавить конфигурацию-заглушку EAS Build
  Что делать / НЕЛЬЗЯ делать: Создать apps/mobile/eas.json с базовыми профилями сборки (development, preview, production). Обновить app.json с placeholder EAS project ID. НЕЛЬЗЯ конфигурировать реальный EAS проект — только скелет.
  Параллелизация: Волна 5 | Заблокировано: 18 | Блокирует: none
  Ссылки: SPECIFICATION.md строка 594 (нативные приложения вне MVP — только заглушка)
  Критерий приёмки: `test -f apps/mobile/eas.json`
  QA: `cd apps/mobile && pnpm expo prebuild` завершается с 0. Доказательства .omo/evidence/task-20-repo-init.log
  Коммит: Y | chore(mobile): add eas build configuration placeholder

- [ ] 21. Добавить шаблоны конфигурации окружения
  Что делать / НЕЛЬЗЯ делать: Создать файлы .env.example для корня, apps/api, apps/mobile. Документировать все требуемые переменные. НЕЛЬЗЯ включать реальные секреты или пароли по умолчанию.
  Параллелизация: Волна 5 | Заблокировано: 1, 7, 13 | Блокирует: none
  Ссылки: SPECIFICATION.md строки 598-603 (deployment decisions)
  Критерий приёмки: `test -f .env.example && test -f apps/api/.env.example && test -f apps/mobile/.env.example`
  QA: `grep -r "password\|secret\|key" .env.example` показывает только placeholder-комментарии, без реальных значений. Доказательства .omo/evidence/task-21-repo-init.log
  Коммит: Y | chore(repo): add environment configuration templates

### Волна 6: Финальная верификация
- [ ] 22. Полная верификация сборки монорепо
  Что делать / НЕЛЬЗЯ делать: Запустить `pnpm install` в корне, затем `pnpm build` во всех пакетах и приложениях. Проверить отсутствие ошибок TypeScript.
  Параллелизация: Волна 6 | Заблокировано: все выше | Блокирует: none
  Ссылки: SPECIFICATION.md строка 572 (запуск одной командой Docker Compose)
  Критерий приёмки: `pnpm build` завершается с 0 из корня
  QA: `pnpm install && pnpm build` завершается с 0, `pnpm lint` завершается с 0 (или показывает только существующие проблемы). Доказательства .omo/evidence/task-22-repo-init.log
  Коммит: N | (только верификация)

- [ ] 23. End-to-end верификация Docker Compose
  Что делать / НЕЛЬЗЯ делать: Запустить `docker compose up --build` и проверить: PostgreSQL стартует, API стартует и отвечает на health check, web-приложение собирается. НЕЛЬЗЯ тестировать полную бизнес-логику.
  Параллелизация: Волна 6 | Заблокировано: все выше | Блокирует: none
  Ссылки: SPECIFICATION.md строка 572 (запуск одной командой)
  Критерий приёмки: `curl http://localhost:3000/health` возвращает 200, `curl http://localhost:3000/api` показывает swagger UI или JSON
  QA: `docker compose up -d --build && sleep 10 && curl -sf http://localhost:3000/health && docker compose down`. Доказательства .omo/evidence/task-23-repo-init.log
  Коммит: N | (только верификация)

- [ ] 24. Аудит соответствия плану
  Что делать / НЕЛЬЗЯ делать: Проверить, что каждый модуль из SPECIFICATION.md строки 419-432 представлен в кодовой базе. Проверить, что все API-маршруты из строк 461-477 имеют соответствующие контроллеры-заглушки. Проверить, что схема Prisma соответствует модели данных строки 437-446.
  Параллелизация: Волна 6 | Заблокировано: все выше | Блокирует: none
  Ссылки: SPECIFICATION.md строки 419-490
  Критерий приёмки: Файл чеклиста `.omo/evidence/compliance-checklist.md` показывает все модули и API найденными
  QA: Ручная верификация чеклиста. Доказательства .omo/evidence/task-24-repo-init.md
  Коммит: N | (только верификация)

## Финальная волна верификации
> Запускается параллельно после ВСЕХ todo. ВСЕ должны ПРОЙТИ. Показать результаты и ждать явного подтверждения пользователя перед объявлением завершения.
- [ ] F1. Аудит соответствия плану
- [ ] F2. Ревью качества кода
- [ ] F3. Реальная ручная QA
- [ ] F4. Соответствие охвату

## Стратегия коммитов
- Атомарные коммиты на todo (или малые группы тесно связанных todo)
- Формат conventional commits: `type(scope): description`
- Нет коммитов во время задач только верификации (F-wave, задачи 22-24)
- Результаты финальной волны верификации прикрепляются как доказательства, не коммитятся
- НЕ коммитить после завершения плана, пока пользователь явно не попросит

## Критерии успеха
- [ ] `pnpm install` успешен из корня
- [ ] `pnpm build` успешен для всех пакетов и приложений
- [ ] `docker compose up -d` запускает PostgreSQL успешно
- [ ] Бэкенд API стартует и отвечает `/health` кодом 200
- [ ] Swagger UI доступен по `/api` или `/api/docs`
- [ ] Сборка фронтенда web проходит с `expo start --web` (или эквивалент)
- [ ] Все 4 вкладки навигации отрисовываются без ошибок
- [ ] Схема Prisma валидируется успешно
- [ ] Все 14 API-маршрутов имеют соответствующие контроллеры-заглушки
- [ ] CI workflow YAML синтаксически валиден
- [ ] Нет секретов в коммитах репозитория
- [ ] Корневой README включает инструкции по установке
- [ ] `.env.example` файлы существуют для всех сервисов
