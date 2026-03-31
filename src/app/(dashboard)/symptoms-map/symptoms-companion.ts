// ---------------------------------------------------------------------------
// Symptoms-map companion — page-level agent state block.
// Deterministic, no AI calls. Read-only module, no post-save reaction.
// ---------------------------------------------------------------------------

export interface SymptomsStateBlock {
  line: string;
  supporting?: string;
}

interface SymptomsContext {
  diaryEntriesLast30: number;
  uniqueSymptoms14: number;
  uniqueSymptoms30: number;
}

export function symptomsStateBlock(ctx: SymptomsContext): SymptomsStateBlock {
  const { diaryEntriesLast30, uniqueSymptoms14, uniqueSymptoms30 } = ctx;

  // No diary entries at all in 30 days
  if (diaryEntriesLast30 === 0) {
    return {
      line: "Мне нужны симптомы, чтобы начать искать паттерны.",
      supporting: "Добавь запись в дневник с отметкой симптома — он появится на карте. Чем чаще фиксируешь, тем точнее я нахожу повторы.",
    };
  }

  // Has diary entries but no symptoms in either period
  if (uniqueSymptoms30 === 0) {
    return {
      line: "Записи в дневнике есть, но симптомы в них не отмечены.",
      supporting: "При следующей записи добавь хотя бы один симптом — и я начну строить карту.",
    };
  }

  // Has symptoms only in 30-day window, not in recent 14
  if (uniqueSymptoms14 === 0 && uniqueSymptoms30 > 0) {
    return {
      line: `За 30 дней я зафиксировал ${formatSymptomCount(uniqueSymptoms30)}. Последние 14 дней — тишина.`,
      supporting: "Если симптомы вернутся — добавь запись, и паттерн станет видимым.",
    };
  }

  // Active symptoms in 14-day window
  if (uniqueSymptoms14 === 1) {
    return {
      line: "Один симптом за 14 дней. Слежу, повторится ли.",
      supporting: "Одиночный сигнал пока мало говорит — продолжай фиксировать.",
    };
  }

  if (uniqueSymptoms14 <= 3) {
    return {
      line: `${uniqueSymptoms14} симптома за 14 дней. Вижу, когда и как часто они появляются.`,
    };
  }

  // 4+ symptoms
  return {
    line: `${uniqueSymptoms14} симптомов за 14 дней. Если что-то повторяется — это уже видно на карте.`,
    supporting: "Повторяющиеся кластеры стоит показать врачу.",
  };
}

function formatSymptomCount(n: number): string {
  if (n === 1) return "1 симптом";
  if (n >= 2 && n <= 4) return `${n} симптома`;
  return `${n} симптомов`;
}
