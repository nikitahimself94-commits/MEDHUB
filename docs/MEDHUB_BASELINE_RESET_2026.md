# MedHUB Baseline Reset 2026

> Canonical baseline для всей дальнейшей разработки.
> Создан 2026-03-27 на основе reconciliation между новым продуктовым брифом и текущим состоянием проекта.
> Любая задача, архитектурное решение или продуктовый спор — сверяется с этим документом.

---

## 1. SOURCE OF TRUTH

| Документ | Роль | Путь |
|---|---|---|
| **MEDHUB_BRIEF_2026.md** | Продуктовый бриф. Определяет ЧТО строим. | `docs/MEDHUB_BRIEF_2026.md` |
| **MEDHUB_BASELINE_RESET_2026.md** | Этот документ. Определяет baseline: от чего отталкиваемся, что legacy, какие фазы. | `docs/MEDHUB_BASELINE_RESET_2026.md` |
| **ACCESS_MODEL.md** | Модель доступа. Всё ещё актуальна — бриф не меняет access model. | `docs/ACCESS_MODEL.md` |
| **DOCUMENT_INTAKE_STRATEGY.md** | Принципы загрузки документов. Актуальна — совместима с модулем "Библиотека". | `docs/DOCUMENT_INTAKE_STRATEGY.md` |

---

## 2. PRODUCT DEFINITION

**MedHUB** — AI-агент медицинского сопровождения с рабочей средой.

- Агент — центр продукта. Интерфейс — его рабочая среда.
- Пользователь не ищет AI внутри продукта. Агент встречает, ведёт, сопровождает.
- Регуляторный периметр: wellness companion / health information. Не диагнозы.
- Тон: "ты", не "вы". Принципиально.
- Визуальная тема: тёплый тёмный. Весь продукт тёмный, без разрывов.

**Главный критерий любого решения:** усиливает ли это ощущение живого сопровождения агентом? Если нет — вторично.

---

## 3. CORE PRODUCT PRINCIPLES

### 3.1 Agent-first
Агент — главный интерфейс доверия. С первой секунды показывает: активен, ведёт, включён. Пользователь не входит в пустой сайт.

### 3.2 Health Map = навигация
Dashboard — не список карточек. Это живая карта здоровья: узлы = модули, линии = корреляции агента. Карта = навигация. Тапнул узел — провалился в раздел.

### 3.3 Три слоя AI
Пользователь видит одного агента. Под капотом:
1. **Скрипт с ротацией** (бесплатно) — приветствия, статусы, подсказки (?), capability unlock, nudge.
2. **Claude Haiku** (быстро) — реакции после записей, комментарии после показателей, лёгкие вопросы в чате.
3. **Claude Sonnet** (по запросу) — глубокий анализ, корреляции, документы, подготовка к врачу. **Sonnet живёт в чате, не в модулях.**

### 3.4 MCO как мозг
Medical Context Object — единый контекст агента. Хранится в Supabase. Читается во всех разделах. Append-only, TTL 30 минут.

### 3.5 Модули = data layer
Модули (Пульс, Линия, Сигналы, Режим, Библиотека, Брифинг, Разговор, Река) — это не самостоятельные приложения. Это источники данных, которые питают агента.

### 3.6 Никогда красный
Для тревожных данных — amber `#f59e0b`. Красный вызывает панику. Запрещён.

### 3.7 Гипотезы, не диагнозы
Структура: что вижу → что это может значить → что проверить. Формулировка: "врачи связывают с [состояние]". Всегда называть специальность врача.

---

## 4. MVP SCOPE

Минимальный продукт по новому брифу:

- Тёмная визуальная система (палитра, поверхности, типографика, анимации Framer Motion)
- Dashboard: "Карта здоровья" — узлы модулей с состояниями, зона агента, одно приоритетное действие
- Нижняя навигация (5 разделов)
- MCO v2: +name, +recent_patterns, +correlations, +pending_nudges, +open_questions, +last_used_templates
- Агентный presence layer: (?) подсказки во всех модулях, sidebar-реплики по триггерам, capability unlock
- Haiku reactive layer: реакции после записей в Пульс и Линию
- Модули: Пульс (diary+emotions), Линия (vitals), Библиотека (documents), Разговор (chat с model router), Брифинг (doctor visit)
- Онбординг: текущий flow + плавный переход на последнем экране
- Guided tour: overlay-тур по элементам для новых пользователей

---

## 5. OUT OF SCOPE

Не делать до стабильного MVP:

- Новые модули за пределами 8 определённых в брифе
- Голосовой ввод
- Мобильное приложение (пока web)
- Социальные функции
- B2B / врачебный портал
- Research Engine (LATER)
- Trial mechanics / paywall (LATER)
- Weekly digest / push-уведомления (LATER)
- Тарифная реализация (структура зафиксирована, реализация — LATER)

---

## 6. TARGET INFORMATION ARCHITECTURE

### Навигация (нижняя панель, 5 разделов)

Названия уточнить после первого прототипа. Структура по брифу:

| # | Раздел | Содержание |
|---|--------|------------|
| 1 | Карта | Health Map — узлы, корреляции, зона агента, приоритетное действие |
| 2 | Пульс | Самочувствие (diary + emotions): 3-step ввод, 30-дневный пульс-календарь |
| 3 | Данные | Линия (vitals) + Сигналы (symptoms) + Режим (medications) — tabs внутри |
| 4 | Библиотека | Документы: слоты по типам, AI-разбор |
| 5 | Ещё | Брифинг (врач) + Разговор (чат) + Река (хронология) + Настройки |

### Модули (8 штук)

| Кодовое имя | Бриф-название | Текущий route | Что меняется |
|---|---|---|---|
| pulse | Пульс | /diary + /emotions | Merge в один модуль, новый 3-step UX, пульс-календарь |
| line | Линия | /vitals | Confidence band, big numeric input, Haiku-реакция |
| signals | Сигналы | /symptoms-map | Новый модуль: body map ввод, частотная карта, отдельная таблица |
| regime | Режим | /medications | Card-per-med UI, teal/amber состояния, agent nudge |
| library | Библиотека | /documents | Slot-based UI по типам, agent captions |
| briefing | Брифинг | /doctor-visit | +выбор специальности, animated assembly |
| talk | Разговор | /ai-chat | Model router (Haiku/Sonnet), MCO-suggested questions |
| river | Река | /timeline | Visual density axis, color-coded by type, agent highlights |

### Вторичные (в настройках / доступны, но не в главной навигации)

- Профиль (медицинская карта) — в настройках
- AI-план (лимиты/квоты) — в настройках

---

## 7. AI LAYER ARCHITECTURE

### Слой 1: Скрипт с ротацией (cost: $0)

| Точка присутствия | Тип | Шаблонов |
|---|---|---|
| Dashboard greeting | Template rotation + Haiku paraphrase | 5-7 per greeting_context |
| Module card statuses | Deterministic from MCO | — |
| (?) tooltips | Static per module/field | 1 per element |
| Capability unlock | Template rotation | 5-7 per milestone |
| Sidebar nudge (section entry / absence) | Template rotation | 5-7 per trigger |
| Action confirmations | Static | 1-2 per action |

**Ротация:** пул 5-7, last-3 exclusion, Haiku paraphrase финального текста.

### Слой 2: Claude Haiku 4.5 (cost: low)

| Триггер | Вход | Выход | Max tokens |
|---|---|---|---|
| Diary save | Текст записи + MCO snapshot | 2-3 фразы реакции | ~100 |
| Vitals save | Значение + тип + недельная история | 1-2 фразы комментария | ~60 |
| Chat (light) | Вопрос + MCO | Ответ навигации / "как дела" | ~200 |
| Greeting paraphrase | Base template + context | Перефразированный текст | ~60 |

### Слой 3: Claude Sonnet 4.6 (cost: tracked)

| Триггер | Вход | Выход |
|---|---|---|
| Chat (medical) | Вопрос + MCO + data snapshot | Развёрнутый анализ, гипотеза, рекомендация |
| Document parse | Файл + MCO | Что увидел, что важно, что делать |
| Doctor visit prep | Специальность + MCO + full data | Структурированный брифинг |
| Weekly insight (batch) | MCO + 7-day data | Недельная сводка |

### Model router (в чате)

Лёгкий вопрос → Haiku. Анализ / корреляция / гипотеза → Sonnet. Пользователь не знает какую модель используют. Классификатор: keyword-based или lightweight prompt.

### Квоты

Текущая инфраструктура (ai_usage_events, 100/30d rolling) сохраняется как основа. Тарифная разбивка (Basic 15 Sonnet / Pro unlimited / Premium + batch) — реализовать при запуске монетизации.

---

## 8. MCO BASELINE

### Текущее (v1 — в коде)

```typescript
interface McoSnapshot {
  entry_mode: string | null
  current_focus: string | null
  last_seen: string | null
  days_absent: number
  time_of_day: "morning" | "day" | "evening" | "night"
  data_completeness: {
    vitals: number
    diary: number
    documents: number
    medications: number
    symptoms: number
    emotions: number
  }
  greeting_context: GreetingContextKey
  priority_action: PriorityActionKey
  updated_at: string
}
```

### Целевое (v2 — по брифу)

Добавить к v1:

```typescript
{
  name: string                    // Имя пользователя для обращения
  recent_patterns: string[]       // Паттерны, найденные агентом
  open_questions: string[]        // Незакрытые вопросы
  pending_nudges: string[]        // Очередь nudge-сообщений
  correlations: Array<{           // Связи между модулями
    from: string
    to: string
    description: string
  }>
  last_used_templates: string[]   // Для rotation anti-repeat
}
```

**Правила v2:** append-only, Edge Function refresh, TTL 30 мин. Correlations и patterns — заполняются по мере накопления данных (не сразу).

---

## 9. LEGACY TO IGNORE

### Документы

| Документ | Статус | Причина |
|---|---|---|
| `docs/AI_FIRST_BLUEPRINT.md` | **LEGACY** | Заменён полностью. Dashboard 5-block layout, навигация 4 таба, roadmap NOW/NEXT/LATER, тарифы Free/Active/Autonomous — всё переопределено брифом. Помечен legacy-хедером. |

### Направления в текущем коде, которые не совместимы с брифом

| Что | Почему legacy |
|---|---|
| Светлая тема (`#C5CECA`, white glass cards, `.card` class) | Бриф: тёплый тёмный `#0d1117` / `#161b22`. Полная замена. |
| Текущий dashboard layout (hero + signals + grid + cards + feed) | Бриф: "Карта здоровья" — SVG/Canvas с узлами и корреляциями. Другая парадигма. |
| Верхняя навигация (4 таба: Сводка, Записи, Документы, Врач) | Бриф: нижняя панель, 5 разделов. |
| Emotions как отдельный модуль | Бриф: merge в "Пульс" (diary + emotions). |
| Symptoms-map (heatmap из diary) | Бриф: "Сигналы" — самостоятельный модуль с body map. |
| AI-plan как отдельная страница | Бриф: квоты в настройках. |
| FirstArrivalOverlay (static card) | Бриф: guided tour с 5-6 остановками. |
| Тон "вы" на dashboard и в модулях | Бриф: только "ты". |

### Документы, которые остаются валидными

| Документ | Почему |
|---|---|
| `docs/ACCESS_MODEL.md` | Бриф не меняет модель доступа. Два пользователя, equal access, patient_id ownership. |
| `docs/SETUP_AND_SMOKE_TEST.md` | Инфраструктурный doc. Supabase setup, миграции, smoke test. |
| `docs/DOCUMENT_INTAKE_STRATEGY.md` | Принципы мягкого intake совместимы с модулем "Библиотека". |

---

## 10. IMPLEMENTATION PHASES

Жёсткие фазы верхнего уровня. Каждая фаза — самостоятельный deliverable.

### Phase 0: Visual Foundation
Тёмная тема, новая палитра, Framer Motion, типографика, surface tokens. Весь продукт переключается на тёмную основу. Без этого невозможно строить ничего дальше.

### Phase 1: Shell
Нижняя навигация (5 tabs). Health Map dashboard — каркас (узлы без корреляций, статусы из MCO, зона агента, приоритетное действие). Онбординг: плавный переход на последнем экране.

### Phase 2: Agent Infrastructure
MCO v2 (расширенные поля). Template pools для всех точек присутствия. Haiku reactive layer (реакции в Пульсе и Линии). (?) tooltips во всех модулях. Sidebar-реплики. Capability unlock.

### Phase 3: Module Redesign
Пульс (merge diary + emotions, 3-step UX). Линия (confidence band, big input). Сигналы (body map, новая таблица). Режим (card-per-med). Библиотека (slots by type). Брифинг (+специальность). Разговор (model router). Река (visual axis).

### Phase 4: Health Map Live
Correlations на карте (линии из MCO.correlations). Animated pulse для активных связей. Amber-состояния узлов. Guided tour для новых пользователей.

### Phase 5: Polish + Monetization Prep
Тон "ты" audit по всем текстам. Тарифная структура (Basic/Pro/Premium UI). Quota enforcement по тарифам. Weekly insight batch (Sonnet, воскресенье).

---

> **Использование этого документа:** перед началом любой задачи — сверить с соответствующей секцией. Если задача не вписывается ни в одну фазу — она out of scope до пересмотра baseline.
