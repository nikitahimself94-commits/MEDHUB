// ---------------------------------------------------------------------------
// Diary post-save agent reaction — deterministic, no AI calls.
// Runs client-side from submitted form data + entry count.
// ---------------------------------------------------------------------------

import { rotated } from "@/lib/template-rotation";

export interface DiaryReaction {
  line: string;          // main agent phrase
  supporting?: string;   // optional second line
}

interface DiaryEntryContext {
  wellbeing: number;       // 1-10
  hasSymptoms: boolean;
  hasPain: boolean;
  hasSleep: boolean;
  hasNotes: boolean;
  isFirstEntry: boolean;
}

// Template pools for frequent states
const MINIMAL_LINES = [
  "Принял. Даже короткая запись — это точка для сравнения.",
  "Принял. Коротко, но достаточно.",
  "Принял. Точка поставлена.",
] as const;

const MID_PLAIN_LINES = [
  "Принял. Запись на месте.",
  "Принял. Зафиксировал.",
  "Принял. Есть.",
] as const;

const GOOD_LINES = [
  "Принял. Стабильно — хороший сигнал.",
  "Принял. Ровно — так и должно быть.",
  "Принял. Всё спокойно.",
] as const;

const LOW_SUPPORTING = [
  "Если завтра не лучше, будет видно по линии.",
  "Послежу за динамикой.",
  "Следующая запись покажет, разовое ли это.",
] as const;

export function diaryPostSaveReaction(ctx: DiaryEntryContext): DiaryReaction {
  // First entry ever — milestone
  if (ctx.isFirstEntry) {
    return {
      line: "Принял. Первая точка есть — теперь мне есть от чего отталкиваться.",
      supporting: ctx.hasSymptoms
        ? "Симптомы тоже зафиксированы."
        : undefined,
    };
  }

  // Minimal entry — only wellbeing, nothing else
  const isMinimal = !ctx.hasSymptoms && !ctx.hasPain && !ctx.hasSleep && !ctx.hasNotes;
  if (isMinimal) {
    return {
      line: rotated("diary:minimal", MINIMAL_LINES),
    };
  }

  // Low wellbeing
  if (ctx.wellbeing <= 3) {
    return {
      line: `Принял. ${ctx.wellbeing}/10 — зафиксировал.`,
      supporting: rotated("diary:low_sup", LOW_SUPPORTING),
    };
  }

  // Mid wellbeing with symptoms
  if (ctx.wellbeing <= 6 && ctx.hasSymptoms) {
    return {
      line: "Принял. Симптомы отмечены — буду следить за повторением.",
      supporting: ctx.hasPain ? "Боль тоже в записи." : undefined,
    };
  }

  // Mid wellbeing with pain but no symptoms
  if (ctx.wellbeing <= 6 && ctx.hasPain) {
    return {
      line: "Принял. Боль зафиксирована.",
      supporting: "Следующая запись покажет, уходит или держится.",
    };
  }

  // Mid wellbeing, no symptoms, no pain
  if (ctx.wellbeing <= 6) {
    return {
      line: rotated("diary:mid_plain", MID_PLAIN_LINES),
    };
  }

  // Good wellbeing (7-10)
  if (ctx.hasSymptoms) {
    return {
      line: "Принял. В целом стабильно, но симптомы отметил.",
    };
  }

  return {
    line: rotated("diary:good", GOOD_LINES),
  };
}
