# MedHUB — Technical Handoff Document

> Актуально на: 2026-03-18. Основано на текущем состоянии кода в production.

---

## 1. Что такое MedHUB сейчас

MedHUB — это AI-агент медицинского сопровождения с рабочей средой для хранения и анализа медицинских данных.

Ключевое отличие от «медицинского кабинета с AI»: продукт начинается с агента, а не с интерфейса. Новый пользователь сначала встречает агента в fullscreen welcome flow, и только потом попадает в рабочую среду. Dashboard — это продолжение разговора, а не отдельный экран.

**Стек:** Next.js 14 (App Router) + Supabase (auth, DB, storage) + Anthropic Claude Sonnet 4.6 + Vercel.

**Production:** https://medhub-app.vercel.app

**Язык интерфейса:** русский.

---

## 2. Что реализовано

### Auth
- Email/password login и signup на одной странице (`/login`, `/login?mode=signup`)
- Signup создаёт auth user → trigger создаёт profile → fallback создаёт patient если trigger не сработал
- OAuth callback route (`/auth/callback`)
- Middleware: защита роутов, редирект `/login` → `/dashboard` для залогиненных
- Post-login/signup redirect → `/dashboard`

### Fullscreen Onboarding Gate
- 5-фазный scripted conversational flow (не форма, не чат)
- Typing animation (RAF-based, adaptive speed 18-30ms/char, initial 400ms delay)
- State machine с branching: concern / systematic / caregiver пути
- 3 типа шагов: agent message, choice cards, text input
- Персонализированное объяснение роли агента на основе ответов
- Сохранение в `profiles.onboarding_context` (jsonb) + `profiles.onboarding_completed_at` (timestamptz)
- Gate блокирует dashboard до завершения (early return, не overlay)
- Bypass: если есть `onboarding_completed_at`, или `onboarding_context`, или реальные данные в продукте

### Dashboard
- Proactive agent hero block (тёмный фон `#1A2F2B`): agent opening → observation → next step → evidence
- 3 состояния hero: empty / partial / rich — разная логика observation и next step
- Hero использует onboarding_context для персонализации
- AI-generated health summary (cached 24h, Claude Sonnet 4.6, 4-part contract)
- «Что важно сегодня» signals (medications intake, diary, vitals staleness, visit prep)
- Quick actions (secondary muted links)
- Active medications display
- Visit prep preview
- Recent activity feed
- AI usage status bar

### AI Chat (`/ai-chat`)
- Conversational AI с full context snapshot: profile, medical profile, diary, vitals, meds, docs, onboarding context
- History: последние 20 сообщений из `ai_chat_messages`
- Evidence-first tone prompt
- Paragraph-based rendering (split by `\n\n`)
- Context layers indicator (медкарта, дневник, показатели, лекарства, документы)

### Data Modules
| Модуль | Роут | Что делает |
|--------|------|------------|
| Дневник | `/diary` | Самочувствие 1-10, симптомы, боль, сон (гибкий ввод: «6-7»), заметки, теги |
| Показатели | `/vitals` | Давление, пульс, температура, SpO2, вес, глюкоза. Per-type placeholders для заметок |
| Лекарства | `/medications` | Активные/неактивные препараты, отметка приёма (intakes), расписание |
| Эмоции | `/emotions` | 5-шкальная оценка: тревога, подавленность, спокойствие, усталость, надежда |
| Документы | `/documents` | Загрузка (PDF/фото), категоризация, AI-разбор, AI second opinion. Dashed drop-zone кнопка |
| Хронология | `/timeline` | Медицинские события: визиты, процедуры, анализы |
| Карта симптомов | `/symptoms-map` | Частота симптомов за 14-30 дней |
| Медкарта | `/profile` | Группа крови, резус, аллергии, хронические, экстренная информация |

### Doctor Visit Prep (`/doctor-visit`)
- AI-генерированная сводка для врача
- Doctor share links с токеном и сроком действия (`/share/[token]`)

### Records Hub (`/records`)
- 3 группы: ежедневное наблюдение, паттерны, базовый контекст
- Навигация к подмодулям

### AI Features
| Feature | Model | Где используется |
|---------|-------|-----------------|
| Health summary | Claude Sonnet 4.6 | Dashboard, 4-part contract (что вижу / главное / пробелы / шаг) |
| AI chat | Claude Sonnet 4.6 | `/ai-chat`, evidence-first tone |
| Doctor visit prep | Claude Sonnet 4.6 | `/doctor-visit` |
| Document parse | Claude Sonnet 4.6 | `/documents` — извлечение данных из меддокументов |
| Document opinion | Claude Sonnet 4.6 | `/documents` — второе мнение |
| AI quota | — | 100 вызовов / 30 дней на пациента, rolling window |

### Navigation (4-section)
- **Сводка** → `/dashboard` (+ `/ai-chat`, `/ai-plan`)
- **Записи** → `/records` (+ diary, medications, vitals, emotions, symptoms-map, timeline, profile)
- **Документы** → `/documents`
- **Врач** → `/doctor-visit` (+ `/share/[token]`)

---

## 3. Пользовательский путь

### Новый пользователь (нет данных, нет onboarding)
```
/login?mode=signup → auth signup → redirect /dashboard
  → page.tsx проверяет: onboarding_completed_at? нет. onboarding_context? нет. product data? нет.
  → return <OnboardingGate /> (fullscreen, dashboard НЕ рендерится)
  → 5-фазный flow: presence → soft entry → clarification → role explain → first action
  → completeOnboarding() сохраняет context + completed_at
  → redirect к /diary или /documents (по ответам)
```

### Повторный вход (onboarding пройден)
```
/login → auth login → redirect /dashboard
  → page.tsx: onboarding_completed_at? да → dashboard рендерится
  → hero использует onboarding_context для персонализированного opening
```

### Существующий пользователь с данными (без onboarding)
```
/login → /dashboard
  → page.tsx: product data (diary/vitals/docs/meds) есть → bypass gate
  → hero рендерится в partial/rich state
```

---

## 4. Продуктовые принципы в коде

### Agent-first
- Реализовано: fullscreen gate говорит первым, proactive hero на dashboard, AI context включает onboarding answers
- Не реализовано: agent presence внутри модулей (diary, vitals, documents)

### User should not enter empty site
- Реализовано: gate блокирует пустой dashboard для новых пользователей
- early return в page.tsx — dashboard JSX не рендерится вообще

### Continuity onboarding → dashboard
- Реализовано: hero opening/observation/next-step строятся из onboarding_context (entry_mode, chronic_detail, has_documents, primary_goal)
- Gate заканчивает: «Первый шаг — прямо сейчас.» → Hero подхватывает: «я на месте.»

### AI is guidance, not just a button
- Реализовано: health summary — 4-part contract (не пересказ, а наблюдение + приоритет + пробелы + шаг)
- AI chat prompt: evidence-first, конкретный, не шаблонный

---

## 5. Что остаётся слабым

### Agent presence обрывается после dashboard
Пользователь выходит из dashboard в `/diary`, `/vitals`, `/documents` — и агент исчезает. Нет реакции на сохранение записи, нет комментария к загруженному документу, нет наблюдения по тренду показателей. Внутри модулей — обычные формы без companion layer.

### Modules UX — функциональны, но не «сопровождают»
Diary, vitals, medications — рабочие формы ввода. Они делают своё дело, но ощущаются как data-entry, а не как часть разговора с агентом. Нет post-action feedback от агента.

### AI chat — отдельный раздел, а не ambient
AI chat живёт в `/ai-chat` как отдельная страница. Нет inline-AI контекста на других экранах. InlineAi компонент на dashboard существует, но минимален.

### Document flow — загрузка работает, AI-разбор есть, но интеграция слабая
Документы загружаются и парсятся, но результаты парсинга не влияют на dashboard observation, не появляются в AI chat context snapshot автоматически.

### Health summary — по запросу, не ambient
Summary генерируется по клику «Получить сводку». Не обновляется автоматически при появлении новых данных.

### Onboarding copy — доведён до рабочего состояния, но может требовать живого тестирования
Typing animation, branching и персонализация работают. Копирайт переписан несколько раз. Нужна валидация на реальных пользователях.

### Mobile — не тестировалось системно
Layout адаптивный (Tailwind responsive), но нет целенаправленного mobile-first прохода.

---

## 6. Текущий приоритетный фокус

### Companion layer внутри модулей
Следующий логичный шаг по принципу agent-first: agent presence не должен заканчиваться на dashboard.

Минимальная версия:
- После сохранения записи в дневнике — короткая реакция агента («Записал. Самочувствие 6/10 — чуть ниже, чем вчера.»)
- После загрузки документа — агент говорит что увидел
- На странице показателей — агент комментирует тренд или отсутствие свежих данных

Это замкнёт петлю «агент ведёт» от входа до рутинного использования.

### Вторичные приоритеты
- Ambient AI summary (auto-refresh при новых данных)
- Document parse results → AI context integration
- Mobile-first validation pass
- AI chat inline presence на ключевых экранах

---

## 7. Ключевые файлы

### Onboarding
- `src/app/(dashboard)/dashboard/onboarding-gate.tsx` — fullscreen UI, typing hook, state machine
- `src/app/(dashboard)/dashboard/onboarding-steps.ts` — сценарий, фазы, branching, весь копирайт
- `src/app/(dashboard)/dashboard/onboarding-actions.ts` — completeOnboarding(), saveOnboardingContext()

### Dashboard
- `src/app/(dashboard)/dashboard/page.tsx` — gate logic, proactive hero, 3-state observation, signals, feed
- `src/app/(dashboard)/dashboard/ai-summary.tsx` — cached AI summary component
- `src/app/(dashboard)/dashboard/summary-action.ts` — Claude call, 4-part prompt contract

### AI
- `src/app/(dashboard)/ai-chat/actions.ts` — buildContextSnapshot(), sendMessage(), system prompt
- `src/lib/check-ai-quota.ts` — 100-call monthly limit
- `src/lib/log-ai-usage.ts` — usage tracking

### Auth
- `src/app/(auth)/login/actions.ts` — login(), signup(), ensurePatientExists()
- `src/lib/supabase/middleware.ts` — session refresh, route protection
- `src/lib/get-patient-id.ts` — getSessionPatient() с auto-create patient fallback

### Navigation
- `src/app/(dashboard)/dashboard-nav.tsx` — 4-section bottom nav
- `src/app/(dashboard)/layout.tsx` — auth check, header, nav wrapper

### Критичные миграции
- `00001` profiles + trigger
- `00002` patients + patient_id linkage
- `00023` onboarding_context
- `00024` auto-create patient on signup
- `00025` onboarding_completed_at

---

## 8. Env Variables (production)

| Переменная | Назначение |
|------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server-side, bypasses RLS) |
| `ANTHROPIC_API_KEY` | Claude API key |

---

## 9. Brand & Visual

- **Primary:** `#2D6E6A` (teal)
- **Dark:** `#1A2F2B` (headings, hero background)
- **Onboarding dark:** `#0F1F1D` (fullscreen gate)
- **Muted:** `#5A8F85`, `#8AA8A2` (secondary text)
- **Font:** Inter (system), DM Sans + Playfair Display (login page)
- **Cards:** white/semi-transparent with subtle shadows
- **Hero:** dark ground, white text, teal accent strip for CTA
