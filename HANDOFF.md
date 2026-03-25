# MedHUB — Technical Handoff Document

> Актуально на: 2026-03-25. Основано на текущем состоянии кода в production.

---

## 1. Что такое MedHUB сейчас

MedHUB — это AI-агент медицинского сопровождения с рабочей средой для хранения и анализа медицинских данных.

Ключевое отличие от «медицинского кабинета с AI»: продукт начинается с агента, а не с интерфейса. Новый пользователь сначала встречает агента в fullscreen welcome flow, и только потом попадает в рабочую среду. Dashboard — это продолжение разговора, а не отдельный экран. Агент присутствует не только на dashboard, но и внутри каждого модуля — через companion-layer (state blocks, post-save reactions).

**Стек:** Next.js 14 (App Router) + Supabase (auth, DB, storage) + Anthropic Claude Sonnet 4.6 + Haiku 4.5 + Vercel.

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
- 7-шаговый scripted conversational flow с branching (не форма, не чат)
- 3 ветки: diagnosis / caregiver / systematic
- Typing animation (RAF-based, adaptive speed 18-30ms/char, initial 400ms delay)
- 3 типа шагов: agent message, choice cards, text input + agent_react и final step types
- Персонализированное объяснение роли агента на основе ответов
- Сохранение в `profiles.onboarding_context` (jsonb): `entry_mode`, `current_focus`, `user_context`
- Completion в `profiles.onboarding_completed_at` (timestamptz)
- Gate блокирует dashboard до завершения (early return, не overlay)
- Bypass: если есть `onboarding_completed_at`, или `onboarding_context`, или реальные данные в продукте

### MCO v1 — Medical Context Object
Единый data-only current snapshot пациента, cached в profiles:

- **Хранение:** `profiles.mco_snapshot` (JSONB) + `profiles.mco_updated_at` (timestamptz)
- **Cache policy:** 30 минут TTL. Пересчёт при отсутствии или stale snapshot.
- **Поля snapshot:**
  - `entry_mode` / `current_focus` — из onboarding_context
  - `last_seen` / `days_absent` — из последней активности в diary/vitals/documents/emotions
  - `time_of_day` — server-side, из tz cookie
  - `data_completeness` — normalized 0..1 per module (capped heuristics)
  - `greeting_context` — state key (first_visit / returned_today / returned_after_1_2_days / returned_after_3_plus_days / returned_after_long_absence_with_data / returned_evening_prompt)
  - `priority_action` — action key (add_diary / add_vitals / upload_document / add_medications / add_emotions / update_diary / none)
  - `updated_at`
- **Builder:** `src/lib/mco.ts` — deterministic, no AI calls, parallel DB queries
- MCO — чисто data foundation. Финальный UI text строится в dashboard layer через mapping functions.

### Dashboard
- **Hero from MCO:** opening (time greeting + situational phrase) → observation → next step CTA → evidence footer
  - Opening: deterministic rotation pools (3 per greeting_context) + Haiku paraphrase layer
  - Observation: deterministic from MCO completeness/days_absent/entry_mode
  - CTA: deterministic from priority_action
  - Evidence: completeness labels per module
- **Haiku paraphrase:** только для hero opening (server-side, await, strict guardrails: length <= base, greeting preserved, name preserved, one sentence). Skip для returned_today. Deterministic fallback при любой ошибке/timeout.
- **Template rotation:** anti-repeat memory (last 3 per context key). Server-side: persistent per-user в `profiles.companion_rotation_state` (JSONB). Client-side: in-memory Map (session-level).
- **Module micro-statuses:** 6-module grid (diary, vitals, documents, medications, emotions, symptoms). MCO-driven one-liners. Primary module highlighted via isPrimary.
- **"Что важно сегодня" signals:** medications intake, diary today, vitals staleness, visit prep. Dedup с hero CTA — signals skip items already covered by priority_action.
- AI-generated health summary (cached 24h, Claude Sonnet 4.6, 4-part contract, only in rich state)
- Inline AI field
- Active medications display
- Visit prep preview
- Recent activity feed
- AI usage status bar

### Companion Layer в модулях

Агент присутствует внутри каждого модуля — не просто формы ввода, а сопровождение.

| Модуль | Тип companion | Что делает |
|--------|--------------|------------|
| Дневник `/diary` | Post-save reaction | Deterministic реакция на запись (wellbeing/symptoms/pain aware), template rotation для частых cases |
| Показатели `/vitals` | Post-save reaction | Type-specific verb reactions ("Давление записал: 120/80."), rotation для supporting lines |
| Документы `/documents` | Page-level state block | Adapts to empty/initial/populated state, shows parsed/opinion counts |
| Эмоции `/emotions` | State block + post-save reaction | State block по количеству записей, reaction по emotional pattern (anxiety/depression/fatigue/calmness/hope) |
| Лекарства `/medications` | State block + post-save reaction | Live intake tracking state, reaction с названием препарата |
| Карта симптомов `/symptoms-map` | Page-level state block | Diary dependency awareness, symptom count per period |

Все companion blocks:
- Deterministic, без AI calls
- Единый тон: спокойный, собранный, не тревожный
- Agent state blocks заменили старые ModuleHelp (кроме diary, где ModuleHelp остаётся)
- Empty-state generic texts ("Записей пока нет") убраны там, где state block уже покрывает

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
| Документы | `/documents` | Загрузка (PDF/фото), категоризация, AI-разбор, AI second opinion |
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
| Health summary | Claude Sonnet 4.6 | Dashboard (rich state), 4-part contract |
| AI chat | Claude Sonnet 4.6 | `/ai-chat`, evidence-first tone |
| Doctor visit prep | Claude Sonnet 4.6 | `/doctor-visit` |
| Document parse | Claude Sonnet 4.6 | `/documents` — извлечение данных |
| Document opinion | Claude Sonnet 4.6 | `/documents` — второе мнение |
| Hero paraphrase | Claude Haiku 4.5 | Dashboard hero opening only |
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
  → 7-шаговый flow: intro → fork → branch → focus → transition → context → handoff
  → completeOnboarding() сохраняет context + completed_at
  → redirect к /dashboard
  → MCO v1 строится (first_visit, all completeness = 0)
  → Hero: opening (Haiku paraphrased) + observation (entry_mode aware) + CTA (add_diary)
  → Module statuses: diary primary, rest "пока пусто"
```

### Повторный вход (onboarding пройден, есть данные)
```
/login → auth login → redirect /dashboard
  → page.tsx: onboarding_completed_at? да → dashboard рендерится
  → MCO v1: cached или rebuild (30 min TTL)
  → Hero: greeting с rotation + Haiku, observation от completeness/days_absent
  → Signals: complementary to hero CTA (dedup)
  → Module statuses: reflect current completeness
```

### Вход в модуль (diary/vitals/documents/emotions/medications/symptoms)
```
/dashboard → click module link или module status → module page
  → Agent state block (если есть): shows current section state
  → User performs action (save/upload)
  → Post-save reaction: deterministic agent feedback (5s display)
  → Page re-renders via revalidatePath
```

---

## 4. Продуктовые принципы в коде

### Agent-first
- Реализовано: fullscreen gate, proactive hero, MCO-driven dashboard, companion-layer во всех модулях, Haiku paraphrase для hero
- Агент присутствует от первого контакта до рутинного использования

### User should not enter empty site
- Реализовано: gate блокирует пустой dashboard, MCO обрабатывает first_visit state

### Continuity onboarding → dashboard → modules
- Реализовано: onboarding_context → MCO → hero opening/observation → module state blocks → post-save reactions
- Единый тон агента across all touchpoints

### AI is guidance, not just a button
- Реализовано: health summary (4-part contract), ambient hero, module companion blocks, Haiku layer

### Deterministic first, model second
- Все companion blocks и reactions — deterministic, no AI calls
- Haiku — только hero opening, с strict guardrails и deterministic fallback
- Rotation — deterministic anti-repeat, not random generation

---

## 5. Что остаётся слабым

### AI chat — отдельный раздел, а не ambient
AI chat живёт в `/ai-chat` как отдельная страница. InlineAi компонент на dashboard существует, но минимален.

### Document flow — AI-разбор есть, но интеграция слабая
Документы загружаются и парсятся, но результаты парсинга не влияют на MCO, не появляются в hero observation.

### Health summary — по запросу, не ambient
Summary генерируется по клику. Не обновляется автоматически при появлении новых данных.

### Diary page — ещё использует ModuleHelp вместо agent state block
Diary — единственный модуль, где остался старый ModuleHelp (статичная инструкция) вместо MCO-driven agent state block.

### Mobile — не тестировалось системно
Layout адаптивный (Tailwind responsive), но нет целенаправленного mobile-first прохода.

### Haiku — только hero opening
Haiku paraphrase layer применён только к dashboard hero opening. Module reactions и state blocks остаются deterministic.

---

## 6. Текущий приоритетный фокус

### Что уже сделано в текущем спринте
- [x] MCO v1 foundation (mco_snapshot, cache policy, builder)
- [x] Dashboard hero from MCO (opening, observation, CTA, evidence)
- [x] Module micro-statuses (6-module grid)
- [x] Companion-layer во всех модулях (diary, vitals, documents, emotions, medications, symptoms-map)
- [x] Template rotation v1 (anti-repeat memory)
- [x] User-scoped rotation memory (persistent in profiles)
- [x] Haiku paraphrase layer for hero opening
- [x] Tone unification pass
- [x] Product hardening (signals dedup, Haiku skip, empty-state cleanup)
- [x] Tech cleanup (Profile types sync, queries consolidation)

### Вторичные приоритеты (не реализовано)
- Diary ModuleHelp → agent state block (last remaining non-companion module)
- Ambient AI summary (auto-refresh при новых данных)
- Document parse results → MCO integration
- Haiku expansion to module state blocks (if proven valuable)
- Mobile-first validation pass
- AI chat inline presence на ключевых экранах

---

## 7. Ключевые файлы

### MCO & Rotation
- `src/lib/mco.ts` — MCO v1 builder, getOrRefreshMco(), types
- `src/lib/template-rotation.ts` — rotated() (client), ServerRotation class (server), RotationState type
- `src/lib/haiku-paraphrase.ts` — paraphraseHeroOpening(), strict validation, guardrails

### Dashboard
- `src/app/(dashboard)/dashboard/page.tsx` — gate logic, MCO integration, hero, signals (dedup), modules, rotation persist
- `src/app/(dashboard)/dashboard/hero-from-mco.ts` — heroOpening(), heroObservation(), heroNextStep(), heroEvidence(), heroDataState()
- `src/app/(dashboard)/dashboard/module-statuses.ts` — moduleStatuses(), per-module status resolvers
- `src/app/(dashboard)/dashboard/ai-summary.tsx` — cached AI summary component
- `src/app/(dashboard)/dashboard/summary-action.ts` — Claude Sonnet call, 4-part prompt

### Companion Layers
- `src/app/(dashboard)/diary/diary-reaction.ts` — diaryPostSaveReaction(), rotation pools
- `src/app/(dashboard)/vitals/vitals-reaction.ts` — vitalsPostSaveReaction(), type-specific verbs
- `src/app/(dashboard)/documents/documents-companion.ts` — documentsCompanion(), state transitions
- `src/app/(dashboard)/emotions/emotions-companion.ts` — emotionsStateBlock(), emotionPostSaveReaction()
- `src/app/(dashboard)/medications/medications-companion.ts` — medicationsStateBlock(), medPostSaveReaction()
- `src/app/(dashboard)/symptoms-map/symptoms-companion.ts` — symptomsStateBlock()

### Onboarding
- `src/app/(dashboard)/dashboard/onboarding-gate.tsx` — fullscreen UI, typing hook, state machine
- `src/app/(dashboard)/dashboard/onboarding-steps.ts` — сценарий, 7 шагов, branching
- `src/app/(dashboard)/dashboard/onboarding-actions.ts` — completeOnboarding(), saveOnboardingContext()

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

### Types & Migrations
- `src/types/database.ts` — synced with migrations 00001–00027
- `supabase/migrations/00026_add_mco_snapshot.sql` — mco_snapshot, mco_updated_at
- `supabase/migrations/00027_add_companion_rotation_state.sql` — companion_rotation_state

### Utilities
- `scripts/reset-all-users.mjs` — full user + data reset (admin tool)

---

## 8. Env Variables (production)

| Переменная | Назначение |
|------------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server-side, bypasses RLS) |
| `ANTHROPIC_API_KEY` | Claude API key (Sonnet + Haiku) |

---

## 9. Brand & Visual

- **Primary:** `#2D6E6A` (teal)
- **Dark:** `#1A2F2B` (headings, hero background)
- **Onboarding dark:** `#0F1F1D` (fullscreen gate)
- **Muted:** `#5A8F85`, `#8AA8A2` (secondary text)
- **Light companion:** `rgba(45,110,106,0.05)` — agent state blocks background
- **Font:** Inter (system), DM Sans + Playfair Display (login page)
- **Cards:** white/semi-transparent with subtle shadows
- **Hero:** dark ground, white text, teal accent strip for CTA
- **Module statuses:** 2-col grid, primary module has accent background
- **Post-save reactions:** light teal background, 5s display timeout

---

## 10. Что сознательно НЕ внедрено

| Решение | Почему |
|---------|--------|
| Haiku в module reactions | UX pass показал text-jump friction. Deterministic + rotation достаточно для reactions |
| Weekly insights / batch intelligence | Требует background workers, cron. Не текущий scope |
| Append-only MCO event history | MCO v1 = current snapshot only. History — следующий слой |
| Nightly batch / background processing | Нет cron/job infrastructure на текущем этапе |
| Broad AI expansion | Haiku ограничен одной точкой (hero opening). Остальное deterministic |
| Module-level Haiku state blocks | Пока не доказана ценность beyond hero |
