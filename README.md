# Family Budget

Монорепозиторий приложения для семейного бюджета — учёт дохода, накопительных конвертов и операций по ним.

## Стек

- **Монорепо:** pnpm + Turborepo
- **Клиент:** Expo + React Native + Expo Router (web через react-native-web)
- **UI:** NativeWind (Tailwind CSS)
- **Состояние:** TanStack Query + Zustand
- **Формы:** React Hook Form + Zod
- **Бэкенд:** NestJS + Fastify
- **API:** REST + OpenAPI
- **Генерация клиента:** Orval
- **База данных:** PostgreSQL + Prisma ORM
- **Авторизация:** Отсутствует в MVP (приложение для приватного контура)
- **Сборка мобильного:** EAS Build (заглушка, вне MVP)
- **Развёртывание:** Docker Compose + GitHub Actions CI

## Быстрый старт

```bash
# 1. Установите pnpm и Node 20
npm install -g pnpm
# или: corepack enable && corepack prepare pnpm@9.15.0 --activate

# 2. Установите зависимости
pnpm install

# 3. Запустите базу данных
pnpm db:up

# 4. Примените миграции и сид
pnpm db:migrate
pnpm db:seed

# 5. Запустите бэкенд и фронтенд
pnpm dev
```

Приложение будет доступно:
- API + Swagger: http://localhost:3000/api
- Веб-интерфейс: http://localhost:8081 (Expo web)

## Запуск в Docker (первый запуск)

Одна команда поднимает PostgreSQL, применяет миграции, запускает API и веб-клиент. Нужны только Docker и Docker Compose.

```bash
cp .env.example .env        # необязательно: без .env действуют значения по умолчанию
docker compose up -d --build
```

Порядок старта: `postgres` (healthy) → `migrate` (разовая `prisma migrate deploy`) → `api` (healthy по `/api/v1/health`) → `web`.
Первая сборка занимает несколько минут (веб-клиент собирается как статический Expo web export).

| Что | Адрес по умолчанию |
|-----|--------------------|
| Веб-клиент | http://localhost:8080 |
| API health | http://localhost:8080/api/v1/health (через веб-сервер) или http://localhost:3000/api/v1/health |
| Swagger UI | http://localhost:3000/api |

Веб-клиент собирается с `EXPO_PUBLIC_API_URL=same-origin`: страница обращается к `/api` на собственном origin, а встроенный сервер
(`scripts/preview/serve-web.mjs`) проксирует `/api` в сервис `api`. Поэтому клиент работает с любого хоста и порта без пересборки.

Данные лежат в томе `postgres_data` и переживают `docker compose restart`, `stop/start` и `down` (без `-v`).
Проверка этого сценария: `pnpm smoke:compose` (изолированный проект и свободные порты; создаёт месяц, конверты и операции,
перезапускает весь стек и сравнивает операции, статусы и балансы до и после — AC-22 / DOD-01).

### Переменные окружения

Полный список с комментариями — в `.env.example` (файл `.env` не коммитится, секретов в репозитории нет).

| Переменная | По умолчанию | Назначение |
|------------|--------------|-----------|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `budget`, `budget`, `family_budget` | Доступ к БД; **смените пароль**, если стек доступен не только вам |
| `POSTGRES_PORT` | `5432` | Порт PostgreSQL на хосте |
| `API_HOST_PORT` | `3000` | Порт API на хосте |
| `WEB_HOST_PORT` | `8080` | Порт веб-клиента на хосте |
| `DATABASE_URL`, `API_PORT`, `API_HOST` | см. `.env.example` | Только для запуска API на хосте (`pnpm dev`); в compose `DATABASE_URL` собирается из `POSTGRES_*` |
| `EXPO_PUBLIC_API_URL` | `http://localhost:3000` | Origin API для `pnpm dev`; образ `web` собирается с `same-origin` |

Занят порт (например, 5432 из `pnpm db:up`)? Задайте другой: `POSTGRES_PORT=55432 WEB_HOST_PORT=8081 docker compose up -d --build`.
Фиксированные имена контейнеров (`family-budget-db`, `family-budget-api`, `family-budget-web`) — два экземпляра одновременно
поднимаются только с `docker-compose.smoke.yml` и своим `--project-name` (так делает `pnpm smoke:compose`).

### Остановка, сброс, обновление

```bash
docker compose stop                      # остановить, данные сохраняются
docker compose down                      # удалить контейнеры, том с данными сохраняется
docker compose down -v                   # СБРОС: удалить контейнеры и том postgres_data (все данные пропадут)
docker compose up -d --build             # применить обновление кода; новые миграции накатывает сервис migrate
docker compose logs -f api               # логи (или migrate / web / postgres)
```

## Структура

```
.
├── apps/
│   ├── api/           # NestJS бэкенд
│   └── mobile/        # Expo приложение (web + mobile)
├── packages/
│   ├── eslint-config/ # Общие правила линтинга
│   ├── tsconfig/      # Общие конфигурации TypeScript
│   └── types/         # Zod-схемы и TypeScript-типы домена
├── docker/            # образ веб-клиента (docker/web), init-скрипты PostgreSQL
├── docker-compose.yml # PostgreSQL + migrate + API + web
└── turbo.json          # Конфигурация Turborepo
```

## Скрипты

| Скрипт | Назначение |
|--------|-----------|
| `pnpm dev` | Запуск бэкенда и фронтенда в режиме разработки |
| `pnpm build` | Сборка всех пакетов |
| `pnpm lint` | Линтинг всех пакетов |
| `pnpm typecheck` | Проверка типов во всех пакетах |
| `pnpm db:up` | Запуск PostgreSQL в Docker |
| `pnpm db:migrate` | Применение миграций Prisma |
| `pnpm db:seed` | Заполнение начальными данными |
| `pnpm db:studio` | Prisma Studio (веб-интерфейс к БД) |

## Требования

- Node.js ≥ 20.0.0
- pnpm ≥ 9.0.0
- Docker + Docker Compose

## Лицензия

UNLICENSED
