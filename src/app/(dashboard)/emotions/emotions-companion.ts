// ---------------------------------------------------------------------------
// Emotions companion — page-level state block + post-save reaction.
// Deterministic, no AI calls.
// ---------------------------------------------------------------------------

import { rotated } from "@/lib/template-rotation";

// === Page-level state block (server-side) ===

export interface EmotionsStateBlock {
  line: string;
  supporting?: string;
}

export function emotionsStateBlock(entryCount: number): EmotionsStateBlock {
  if (entryCount === 0) {
    return {
      line: "Эмоциональный слой пока пустой. Одна запись — и я начну его учитывать.",
      supporting: "Пять шкал. Заметку добавлять необязательно.",
    };
  }

  if (entryCount <= 2) {
    return {
      line: "Начало есть. Регулярные записи покажут, как эмоции связаны с самочувствием.",
    };
  }

  if (entryCount <= 5) {
    return {
      line: "Эмоциональный слой наполняется. Закономерности станут виднее со временем.",
    };
  }

  return {
    line: "Эмоции отслеживаются. Учитываю при анализе.",
  };
}

// === Post-save reaction (client-side) ===

export interface EmotionReaction {
  line: string;
  supporting?: string;
}

interface EmotionScores {
  anxiety: number;
  depression: number;
  calmness: number;
  fatigue: number;
  hope: number;
}

interface EmotionReactionContext {
  scores: EmotionScores;
  hasNotes: boolean;
  isFirstEntry: boolean;
}

export function emotionPostSaveReaction(ctx: EmotionReactionContext): EmotionReaction {
  const { scores, isFirstEntry } = ctx;

  // First entry — milestone
  if (isFirstEntry) {
    return {
      line: "Принял. Первая точка эмоционального слоя на месте.",
      supporting: "Теперь есть от чего отталкиваться.",
    };
  }

  // High anxiety or depression — acknowledge without alarm
  if (scores.anxiety >= 4 && scores.hope <= 2) {
    return {
      line: "Принял. Тревога высокая, надежда низкая — зафиксировал.",
      supporting: "Если повторится, будет видно по линии.",
    };
  }

  if (scores.depression >= 4 && scores.calmness <= 2) {
    return {
      line: "Принял. Тяжёлое состояние — на записи.",
      supporting: "Это часть картины, которую я отслеживаю.",
    };
  }

  // High fatigue
  if (scores.fatigue >= 4) {
    return {
      line: "Принял. Усталость заметная — отмечено.",
    };
  }

  // Positive state
  if (scores.calmness >= 4 && scores.hope >= 4) {
    return {
      line: "Принял. Спокойствие и надежда высокие — хороший сигнал.",
    };
  }

  // Neutral / mixed
  if (ctx.hasNotes) {
    return {
      line: rotated("emotions:with_notes", [
        "Принял. Запись с заметкой — контекст помогает.",
        "Принял. Заметка добавляет глубины.",
        "Принял. С контекстом яснее.",
      ] as const),
    };
  }

  return {
    line: rotated("emotions:default", [
      "Принял. Эмоциональный срез зафиксирован.",
      "Принял. Отмечено.",
      "Принял. Точка есть.",
    ] as const),
  };
}
