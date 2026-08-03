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
├── docker-compose.yml # PostgreSQL + API
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
