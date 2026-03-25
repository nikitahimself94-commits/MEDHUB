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
      line: "Симптомов пока нет — нужны записи в дневнике.",
      supporting: "Когда вы отмечаете симптомы в дневнике, они появляются здесь на карте.",
    };
  }

  // Has diary entries but no symptoms in either period
  if (uniqueSymptoms30 === 0) {
    return {
      line: "Записи в дневнике есть, но симптомы в них не отмечены.",
      supporting: "Если добавите симптомы при следующей записи — они появятся на карте.",
    };
  }

  // Has symptoms only in 30-day window, not in recent 14
  if (uniqueSymptoms14 === 0 && uniqueSymptoms30 > 0) {
    return {
      line: `За 30 дней отмечено ${formatSymptomCount(uniqueSymptoms30)}. В последние 14 дней — тихо.`,
    };
  }

  // Active symptoms in 14-day window
  if (uniqueSymptoms14 === 1) {
    return {
      line: "Один симптом за последние 14 дней. Слежу, повторится ли.",
    };
  }

  if (uniqueSymptoms14 <= 3) {
    return {
      line: `${uniqueSymptoms14} симптома за 14 дней. Карта показывает, когда именно.`,
    };
  }

  // 4+ symptoms
  return {
    line: `${uniqueSymptoms14} симптомов за 14 дней. Если что-то повторяется — это видно на карте.`,
    supporting: "Повторяющиеся паттерны стоит показать врачу.",
  };
}

function formatSymptomCount(n: number): string {
  if (n === 1) return "1 симптом";
  if (n >= 2 && n <= 4) return `${n} симптома`;
  return `${n} симптомов`;
}
