// ---------------------------------------------------------------------------
// Vitals post-save agent reaction — deterministic, no AI calls.
// Runs client-side from submitted vital data + entry count.
// ---------------------------------------------------------------------------

import { rotated } from "@/lib/template-rotation";

export interface VitalsReaction {
  line: string;
  supporting?: string;
}

interface VitalEntryContext {
  vitalType: string;
  vitalLabel: string;
  value: string;
  isFirstEntry: boolean;
}

const TYPE_REACTIONS: Record<string, { verb: string; contexts: readonly string[] }> = {
  blood_pressure: {
    verb: "Давление записал",
    contexts: ["Регулярные измерения покажут тренд.", "Есть с чем сравнивать.", "На месте."],
  },
  pulse: {
    verb: "Пульс записал",
    contexts: ["Сравню со следующим измерением.", "Точка есть.", "Зафиксировано."],
  },
  temperature: {
    verb: "Температуру записал",
    contexts: ["Если изменится — будет видно.", "Отмечено.", "Есть."],
  },
  spo2: {
    verb: "Сатурацию записал",
    contexts: ["Точка для сравнения есть.", "На месте.", "Зафиксировано."],
  },
  weight: {
    verb: "Вес записал",
    contexts: ["Динамика станет видна со временем.", "Отмечено.", "Есть с чем сравнить."],
  },
  glucose: {
    verb: "Глюкозу записал",
    contexts: ["Регулярные замеры покажут динамику.", "Точка есть.", "Зафиксировано."],
  },
};

export function vitalsPostSaveReaction(ctx: VitalEntryContext): VitalsReaction {
  const typeInfo = TYPE_REACTIONS[ctx.vitalType];
  // First entry ever
  if (ctx.isFirstEntry) {
    return {
      line: `Принял. Первый показатель на месте — ${ctx.vitalLabel.toLowerCase()} ${ctx.value}.`,
      supporting: "Следующее измерение даст мне точку для сравнения.",
    };
  }

  // Known vital type
  if (typeInfo) {
    return {
      line: `${typeInfo.verb}: ${ctx.value}.`,
      supporting: rotated(`vitals:${ctx.vitalType}`, typeInfo.contexts),
    };
  }

  // Unknown type fallback
  return {
    line: `Принял: ${ctx.vitalLabel} ${ctx.value}.`,
    supporting: "Зафиксировано.",
  };
}
