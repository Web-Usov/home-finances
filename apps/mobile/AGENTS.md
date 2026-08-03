# apps/mobile — База знаний фронтенда

**Стек:** Expo SDK 51 + React Native Web + Expo Router + NativeWind v4 + TanStack Query + Zustand + React Hook Form

## Обзор

Web-first UI бюджета с 4 вкладками: Месяц (дашборд), История, Аналитика, Конверты.
Собрано для запуска как веб-приложение через `react-native-web`; мобильные сборки отложены на post-MVP.

## Структура

```
mobile/
├── app/                        # Файловые маршруты Expo Router
│   ├── _layout.tsx             # Корневой layout: обёртка Providers
│   ├── index.tsx               # Редирект → /(tabs)/month
│   └── (tabs)/                 # Bottom tab navigator
│       ├── _layout.tsx         # Конфиг таб-бара
│       ├── month.tsx           # Экран дашборда
│       ├── history.tsx         # Список операций
│       ├── analytics.tsx       # Годовые отчёты
│       └── envelopes.tsx       # Управление конвертами
├── src/
│   ├── providers/
│   │   ├── QueryProvider.tsx     # Клиент TanStack Query
│   │   └── index.tsx             # Общая обёртка провайдеров
│   ├── stores/
│   │   ├── monthStore.ts         # Текущий выбранный период
│   │   ├── envelopeStore.ts      # Выбранный ID конверта
│   │   └── uiStore.ts            # Состояние сайдбара, активная вкладка
│   ├── components/
│   │   └── FormInput.tsx         # RHF + NativeWind input
│   ├── api/
│   │   └── axios-instance.ts     # Базовая конфигурация Axios
│   └── types/
│       └── env.d.ts              # Типы process.env для TS
├── orval.config.js             # Генератор API-клиента (react-query)
├── tailwind.config.js          # Кастомные цвета (primary, success, warning, danger)
├── global.css                  # Директивы Tailwind
└── metro.config.js             # Интеграция NativeWind с Metro
```

## Где искать

| Задача | Файл | Примечания |
|--------|------|-----------|
| Добавить новый экран | `app/<route>.tsx` или `app/(tabs)/<tab>.tsx` | Имя файла = путь маршрута. Default export = компонент экрана. |
| Добавить общий компонент | `src/components/` | Использовать `className` для стилизации. Импортировать из `react-native`. |
| Добавить стор | `src/stores/<name>Store.ts` | Zustand, простой интерфейс + действия. Реэкспортировать из `index.ts`. |
| Вызвать API бэкенда | Использовать Orval-сгенерированные хуки | Запустить `pnpm orval` при работающем бэкенде для регенерации. |
| Стилизовать компонент | Проп `className` | Никогда `StyleSheet.create`. Цвета определены в `tailwind.config.js`. |
| Валидация форм | `FormInput.tsx` + Zod-схемы из `@family-budget/types` | Использовать `@hookform/resolvers/zod`. |

## Конвенции

- **Маршрутизация:** Файловая Expo Router. Группа `(tabs)/` отрисовывает bottom tab bar. Файлы `_layout.tsx` определяют layout-обёртки.
- **Стилизация:** NativeWind v4 — `className` на всех RN-компонентах. Кастомные тематические цвета в `tailwind.config.js`: `primary-50..900`, `success`, `warning`, `danger`, `info`.
- **Состояние:** Серверное состояние через TanStack Query (5 мин staleTime, без refetch при фокусе). Локальное состояние через Zustand.
- **Формы:** React Hook Form с компонентом `FormInput`. Zod resolver из общего пакета типов.
- **API-клиент:** Orval генерирует React Query хуки из OpenAPI-спеки бэкенда. Конфиг указывает на `http://localhost:3000/api/swagger.json`.

## Анти-паттерны

- **Не использовать `StyleSheet.create`** — только NativeWind.
- **Не хардкодить URL API** — использовать `process.env.EXPO_PUBLIC_API_URL`.
- **Не дублировать Zod-схемы** — импортировать из `@family-budget/types`.
- **Не добавлять платформенно-специфичный код** без необходимости — приложение ориентировано сначала на web, затем на mobile.

## Команды

```bash
cd apps/mobile
pnpm dev                # expo start
pnpm dev:web            # expo start --web
pnpm build:web          # expo export --platform web
pnpm typecheck          # tsc --noEmit
pnpm orval              # Генерация API-клиента (требуется запущенный бэкенд)
```
