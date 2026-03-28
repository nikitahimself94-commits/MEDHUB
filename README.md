# MedHUB

AI-агент медицинского сопровождения с рабочей средой для хранения и анализа медицинских данных.

Язык интерфейса: русский.

## Tech stack

- **Framework:** Next.js 14.2 (App Router), TypeScript
- **Styling:** Tailwind CSS 3.4, Framer Motion
- **Backend:** Supabase (PostgreSQL + Auth + Storage). Вся серверная логика через Next.js server actions, нет отдельных API routes
- **AI:** Anthropic Claude Sonnet 4.6 + Haiku 4.5 (`@anthropic-ai/sdk`)
- **Charts:** Recharts
- **Testing:** Playwright (e2e)
- **Deploy:** Vercel

## Routes and modules

### Auth
| Route | Описание |
|-------|----------|
| `/login` | Вход и регистрация (`?mode=signup`) |
| `/auth/callback` | OAuth callback (route handler) |

### Protected (dashboard)
| Route | Модуль | Server actions |
|-------|--------|---------------|
| `/dashboard` | Главный экран: 2-column workspace, state panel, module cards, CTA | `summary-action.ts`, `onboarding-actions.ts` |
| `/diary` | Дневник: самочувствие, симптомы, боль, сон | `actions.ts` (create, delete) |
| `/vitals` | Показатели: давление, пульс, температура, SpO2, вес, глюкоза + график | `actions.ts` (create, delete) |
| `/medications` | Лекарства: активные препараты, отметка приёма, расписание | `actions.ts` (create, delete, intake, toggle, undo) |
| `/documents` | Документы: загрузка файлов, AI-разбор, второе мнение | `actions.ts` (create, delete, parseDocument, generateSecondOpinion) |
| `/emotions` | Эмоции: 5-шкальная оценка (тревога, подавленность, спокойствие, усталость, надежда) | `actions.ts` (create, delete) |
| `/symptoms-map` | Карта симптомов: heatmap частоты за 14/30 дней (read-only из diary) | нет |
| `/timeline` | Хронология: медицинские события | `actions.ts` (create, delete) |
| `/profile` | Медкарта: группа крови, аллергии, хронические заболевания | `actions.ts` (upsert) |
| `/ai-chat` | AI-чат с полным контекстом пациента | `actions.ts` (sendMessage) |
| `/ai-plan` | AI-план наблюдения на 2 недели (runtime, без персистенции) | `actions.ts` (generateHealthPlan) |
| `/doctor-visit` | Подготовка к визиту: AI-сводка + share-ссылки для врача | `actions.ts` (generateVisitPrep, createShareLink, revokeShareLink) |
| `/records` | Навигационный хаб к подмодулям | нет |

### Public
| Route | Описание |
|-------|----------|
| `/share/[token]` | Публичная read-only страница для врача (валидация токена + срок действия) |

## Architecture notes

- **App Router** — все protected routes в `src/app/(dashboard)/`, layout с bottom-nav
- **Server actions** — вся мутация данных через `"use server"` actions в каждом модуле. Нет `src/app/api/`
- **MCO (Medical Context Object)** — cached snapshot состояния пациента в `profiles.mco_snapshot`, TTL 30 мин. Строится детерминистически в `src/lib/mco.ts`
- **Onboarding** — 7-шаговый branching flow (state machine, без AI), сохраняет контекст в `profiles.onboarding_context`
- **Companion layer** — deterministic agent reactions внутри каждого модуля (post-save reactions, state blocks)

## Database / Supabase

28 SQL миграций в `supabase/migrations/` (00001–00028).

**Таблицы (16):** profiles, patients, medical_profile, diary_entries, documents, medications, medication_intakes, vitals, timeline_events, emotion_entries, ai_chat_messages, document_parses, document_opinions, doctor_visit_preps, ai_usage_events, doctor_share_links.

**Storage:** 1 private bucket `documents`.

**RLS:** включён на всех таблицах. Стандартный паттерн: `patient_id IN (SELECT patient_id FROM profiles WHERE user_id = auth.uid())`.

**Trigger:** `handle_new_user()` — автоматически создаёт patient + profile при регистрации (миграция 00024).

**Ownership:** все продуктовые таблицы ссылаются на `patient_id`, не на `user_id`.

## AI features

| Feature | Model | Файл | Quota | max_tokens |
|---------|-------|------|-------|------------|
| AI-чат | Claude Sonnet 4.6 | `ai-chat/actions.ts` | да | 1024 |
| AI-план | Claude Sonnet 4.6 | `ai-plan/actions.ts` | да | 2048 |
| Разбор документа | Claude Sonnet 4.6 | `documents/actions.ts` | да | 2048 |
| Второе мнение | Claude Sonnet 4.6 | `documents/actions.ts` | да | 2048 |
| Подготовка к визиту | Claude Sonnet 4.6 | `doctor-visit/actions.ts` | да | 2048 |
| Health summary (dashboard) | Claude Sonnet 4.6 | `dashboard/summary-action.ts` | да | 600 |
| Hero paraphrase | Claude Haiku 4.5 | `src/lib/haiku-paraphrase.ts` | нет | 60 |

**Quota:** 100 вызовов / 30 дней (rolling window). Проверяется в `src/lib/check-ai-quota.ts`, логируется в `ai_usage_events`.

## Access model

Единая модель доступа. Все авторизованные пользователи имеют одинаковый доступ ко всем разделам и данным. Роль (`patient` / `guardian`) — атрибут профиля, не влияет на permissions. Нет admin-панели, нет role-based routing. Подробнее: [docs/ACCESS_MODEL.md](docs/ACCESS_MODEL.md).

## Environment variables

Скопируйте `.env.example` → `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=      # Supabase service role key (server-side)
ANTHROPIC_API_KEY=              # Anthropic API key для Claude
```

## Local development

```bash
npm install
cp .env.example .env.local  # заполнить значения
npm run dev                  # http://localhost:3000
```

**Scripts:**
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run test:e2e` — Playwright tests

## Project structure

```
src/
├── app/
│   ├── (auth)/login/          — авторизация
│   ├── (dashboard)/           — 14 protected modules
│   │   ├── dashboard/         — главный экран (state panel + module cards)
│   │   ├── diary/             — дневник самочувствия
│   │   ├── vitals/            — показатели здоровья
│   │   ├── medications/       — трекер лекарств
│   │   ├── documents/         — документы + AI-разбор
│   │   ├── emotions/          — эмоциональный трекер
│   │   ├── symptoms-map/      — карта симптомов
│   │   ├── timeline/          — хронология событий
│   │   ├── profile/           — медкарта
│   │   ├── ai-chat/           — AI-чат
│   │   ├── ai-plan/           — AI-план наблюдения
│   │   ├── doctor-visit/      — подготовка к визиту
│   │   └── records/           — навигационный хаб
│   ├── auth/callback/         — OAuth callback
│   └── share/[token]/         — публичная share-страница
├── components/                — shared UI
├── lib/                       — core utilities (MCO, Supabase clients, AI quota)
└── types/database.ts          — типы БД (синхронизированы с миграциями)
supabase/
├── migrations/                — 28 SQL миграций
└── SEED_INSTRUCTIONS.md       — создание тестовых пользователей
```
