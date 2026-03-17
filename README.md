# MedHub

Персональная медицинская карточка с AI-агентом.

## Стек

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Auth + Storage)
- Claude API (Phase 3)

## Запуск

```bash
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Переменные окружения

Скопируйте `.env.example` → `.env.local` и заполните значения из Supabase Dashboard.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Модель доступа

Все авторизованные пользователи имеют одинаковый доступ ко всем разделам и данным.
Роль (`patient` / `guardian`) хранится в `profiles.role` как атрибут профиля и не влияет на permissions.
Подробнее: [docs/ACCESS_MODEL.md](docs/ACCESS_MODEL.md).

## Структура проекта

```
src/
├── app/
│   ├── (auth)/login/       — авторизация
│   ├── (dashboard)/        — защищённые разделы
│   │   ├── profile/        — медицинская карточка
│   │   ├── diary/          — дневник самочувствия
│   │   ├── documents/      — хранилище документов
│   │   └── medications/    — трекер лекарств
│   └── auth/callback/      — OAuth callback
├── components/ui/          — UI-компоненты
├── lib/supabase/           — Supabase clients
└── types/                  — TypeScript типы
supabase/
├── migrations/             — SQL миграции
└── SEED_INSTRUCTIONS.md    — инструкция по созданию пользователей
```
