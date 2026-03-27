import type { McoSnapshot, GreetingContextKey, PriorityActionKey } from "@/lib/mco";
import type { ServerRotation } from "@/lib/template-rotation";

// ---------------------------------------------------------------------------
// Dashboard hero presentation layer — maps MCO data keys to display strings.
// MCO stays data-only. All copy lives here, in the dashboard layer.
// Tone: "ты", не "вы". Принципиально (MEDHUB_BRIEF_2026).
// ---------------------------------------------------------------------------

// --- Opening line ---

const TIME_GREETINGS: Record<McoSnapshot["time_of_day"], string> = {
  morning: "Доброе утро",
  day: "Привет",
  evening: "Добрый вечер",
  night: "Доброй ночи",
};

const GREETING_POOLS: Record<GreetingContextKey, readonly string[]> = {
  first_visit: [
    "я на месте.",
    "рад, что ты здесь.",
    "я готов начать.",
  ],
  returned_today: [
    "",
    "",
    "",
  ],
  returned_evening_prompt: [
    "ещё можно зафиксировать день.",
    "день ещё не закрыт — можно записать.",
    "вечер — хорошее время зафиксировать состояние.",
  ],
  returned_after_1_2_days: [
    "с возвращением.",
    "рад тебя видеть.",
    "снова на связи.",
  ],
  returned_after_3_plus_days: [
    "давно не заходил — давай обновим.",
    "давно не виделись. Давай наверстаем.",
    "тебя не было какое-то время. Обновим данные.",
  ],
  returned_after_long_absence_with_data: [
    "данные на месте, но свежих записей не хватает.",
    "основа есть, но давно без обновлений.",
    "база сохранилась. Свежая запись оживит её.",
  ],
};

export function heroOpening(mco: McoSnapshot, displayName: string, rotation: ServerRotation): string {
  const timeGreet = TIME_GREETINGS[mco.time_of_day];
  const name = displayName || "";
  const situational = rotation.pick(`hero:greeting:${mco.greeting_context}`, GREETING_POOLS[mco.greeting_context]);

  const greeting = name ? `${timeGreet}, ${name}` : timeGreet;

  if (!situational) return `${greeting}.`;
  return `${greeting} — ${situational}`;
}

// --- Observation line ---

export function heroObservation(mco: McoSnapshot): string {
  const c = mco.data_completeness;
  const filledCount = Object.values(c).filter((v) => v > 0).length;
  const totalLayers = Object.keys(c).length;

  // First visit — no data at all
  if (mco.greeting_context === "first_visit") {
    return entryModeObservation(mco.entry_mode);
  }

  // --- v2: prefer MCO patterns/questions when available ---
  const pattern = mco.recent_patterns?.[0];
  const question = mco.open_questions?.[0];

  // Has data — describe completeness state
  if (filledCount === 0) {
    if (question) {
      return `Сейчас главный пробел — ${question.toLowerCase()}.`;
    }
    return "Мне нужна первая точка данных — запись самочувствия, показатель или документ.";
  }

  if (filledCount <= 2) {
    if (pattern && question) {
      return `${pattern} — от этого уже можно отталкиваться. Но ${question.toLowerCase()}.`;
    }
    if (pattern) {
      return `${pattern} — от этого уже можно отталкиваться.`;
    }
    const missing = missingLayers(c);
    if (missing.length > 0) {
      return `Часть данных уже есть, но ${missing.slice(0, 2).join(" и ")} пока пусто. Каждый новый слой делает мои выводы точнее.`;
    }
  }

  if (filledCount >= 3) {
    if (mco.days_absent >= 3) {
      return "Данные есть из нескольких источников, но свежих записей давно не было. Обнови — и картина станет актуальной.";
    }
    if (mco.days_absent >= 1) {
      return "Картина складывается. Свежая запись сделает её точнее.";
    }
    const pct = Math.round((filledCount / totalLayers) * 100);
    if (pct >= 80) {
      return "Картина почти полная. Данные поступают — ничего критичного не вижу.";
    }
    if (pattern) {
      return `${pattern}. Общая картина складывается.`;
    }
    return "Данные есть из нескольких источников. Общая картина складывается.";
  }

  return "Я вижу твою ситуацию. Продолжаем собирать картину.";
}

function entryModeObservation(entryMode: string | null): string {
  switch (entryMode) {
    case "diagnosis":
      return "Я запомнил твою ситуацию. Первая запись — и я начну отслеживать.";
    case "caregiver":
      return "Я буду держать картину. Добавь первую запись — и мне будет от чего отталкиваться.";
    case "systematic":
      return "Хорошее начало. Первая точка данных — и я начну собирать твою линию.";
    default:
      return "Мне нужна первая точка данных — запись самочувствия, показатель или документ.";
  }
}

function missingLayers(c: McoSnapshot["data_completeness"]): string[] {
  const labels: [keyof typeof c, string][] = [
    ["diary", "дневник"],
    ["vitals", "показатели"],
    ["documents", "документы"],
    ["medications", "лекарства"],
    ["emotions", "эмоции"],
  ];
  return labels.filter(([key]) => c[key] === 0).map(([, label]) => label);
}

// --- Next step CTA ---

interface HeroCta {
  text: string;
  sub: string;
  href: string;
}

const ACTION_MAP: Record<PriorityActionKey, HeroCta> = {
  add_diary: {
    text: "Записать самочувствие",
    sub: "Самый быстрый способ дать мне первую опору",
    href: "/diary",
  },
  add_vitals: {
    text: "Добавить показатель",
    sub: "Конкретная цифра лучше, чем ощущение",
    href: "/vitals",
  },
  upload_document: {
    text: "Загрузить документ",
    sub: "Анализ или заключение — и мне будет с чем работать",
    href: "/documents",
  },
  add_medications: {
    text: "Добавить лекарства",
    sub: "Чтобы я мог учитывать назначения в анализе",
    href: "/medications",
  },
  add_emotions: {
    text: "Записать эмоциональное состояние",
    sub: "Эмоции помогают мне точнее видеть ситуацию",
    href: "/emotions",
  },
  update_diary: {
    text: "Обновить дневник",
    sub: "Регулярность записей делает выводы точнее",
    href: "/diary",
  },
  none: {
    text: "Спроси меня о данных",
    sub: "Могу разобрать тренды или подготовить вопросы врачу",
    href: "/ai-chat",
  },
};

export function heroNextStep(mco: McoSnapshot): HeroCta {
  const base = ACTION_MAP[mco.priority_action];
  const nudge = mco.pending_nudges?.[0];
  if (nudge) {
    return { ...base, sub: nudge };
  }
  return base;
}

// --- Evidence items ---

export interface HeroEvidence {
  label: string;
  detail: string;
  href: string;
}

export function heroEvidence(mco: McoSnapshot): HeroEvidence[] {
  const c = mco.data_completeness;
  const items: HeroEvidence[] = [];

  if (c.diary > 0) {
    items.push({ label: "Дневник", detail: completenessLabel(c.diary), href: "/diary" });
  }
  if (c.vitals > 0) {
    items.push({ label: "Показатели", detail: completenessLabel(c.vitals), href: "/vitals" });
  }
  if (c.medications > 0) {
    items.push({ label: "Лекарства", detail: "есть", href: "/medications" });
  }
  if (c.documents > 0) {
    items.push({ label: "Документы", detail: completenessLabel(c.documents), href: "/documents" });
  }
  if (c.emotions > 0) {
    items.push({ label: "Эмоции", detail: completenessLabel(c.emotions), href: "/emotions" });
  }

  if (items.length === 0 && mco.entry_mode) {
    items.push({ label: "Знакомство", detail: "контекст сохранён", href: "/ai-chat" });
  }

  return items;
}

function completenessLabel(score: number): string {
  if (score >= 1) return "достаточно";
  if (score >= 0.6) return "набирается";
  return "начало";
}

// --- Data state ---

export function heroDataState(mco: McoSnapshot): "empty" | "partial" | "rich" {
  const c = mco.data_completeness;
  const filledCount = Object.values(c).filter((v) => v > 0).length;
  if (filledCount === 0) return "empty";
  if (filledCount <= 2) return "partial";
  return "rich";
}

// --- Unlock message (max 1, deterministic milestone) ---

export function heroUnlockMessage(mco: McoSnapshot): string | null {
  if (mco.greeting_context === "first_visit") return null;

  const c = mco.data_completeness;
  const filled = Object.values(c).filter((v) => v > 0).length;

  if (filled >= 5) return "Все основные данные на месте — могу строить полную картину";
  if (c.documents > 0 && filled >= 3) return "Документы загружены — анализирую вместе с остальными данными";
  if (filled >= 3) return "Несколько слоёв данных — картина становится объёмной";
  if (filled === 1) return "Первый слой данных есть — начинаю видеть картину";
  return null;
}

// --- Map helper (contextual line above health map) ---

export function heroMapHelper(mco: McoSnapshot): string | null {
  const c = mco.data_completeness;
  const filled = Object.values(c).filter((v) => v > 0).length;

  if (filled === 0) return "Каждый узел — это слой данных. Начни с любого.";
  if (filled <= 2) return "Активные узлы уже работают. Заполни остальные — картина станет точнее.";
  if (mco.correlations.length > 0) return "Между узлами уже есть связи. Чем больше данных, тем яснее сигнал.";
  return null;
}

// --- Section-entry nudges (max 2, deterministic) ---

export interface SectionNudge {
  text: string;
  href: string;
}

export function heroSectionNudges(mco: McoSnapshot): SectionNudge[] {
  const c = mco.data_completeness;
  const out: SectionNudge[] = [];

  if (mco.priority_action === "add_diary" || mco.priority_action === "update_diary") {
    out.push({ text: "Дневник ждёт свежую запись", href: "/diary" });
  } else if (mco.priority_action === "add_vitals") {
    out.push({ text: "Добавь показатель — давление, пульс или температуру", href: "/vitals" });
  } else if (mco.priority_action === "upload_document") {
    out.push({ text: "Загрузи анализ или заключение", href: "/documents" });
  }

  if (out.length < 2 && c.diary > 0 && c.vitals === 0) {
    out.push({ text: "К дневнику бы добавить цифры — показатели", href: "/vitals" });
  }
  if (out.length < 2 && c.vitals > 0 && c.diary === 0) {
    out.push({ text: "Показатели есть — дневник сделает картину полнее", href: "/diary" });
  }
  if (out.length < 2 && c.diary > 0 && c.vitals > 0 && c.documents === 0) {
    out.push({ text: "Документ закрепит картину", href: "/documents" });
  }

  return out.slice(0, 2);
}
