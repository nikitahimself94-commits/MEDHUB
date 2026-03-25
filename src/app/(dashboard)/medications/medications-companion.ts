// ---------------------------------------------------------------------------
// Medications companion — page-level state block + post-save reaction.
// Deterministic, no AI calls.
// ---------------------------------------------------------------------------

// === Page-level state block (server-side) ===

export interface MedsStateBlock {
  line: string;
  supporting?: string;
}

interface MedsStateContext {
  activeCount: number;
  inactiveCount: number;
  takenTodayCount: number;   // how many active meds have at least 1 intake today
}

export function medicationsStateBlock(ctx: MedsStateContext): MedsStateBlock {
  const { activeCount, inactiveCount, takenTodayCount } = ctx;
  const total = activeCount + inactiveCount;

  if (total === 0) {
    return {
      line: "Назначений пока нет. Добавьте препарат — и я буду его учитывать.",
      supporting: "Название, дозировка, расписание — всё, что знаете.",
    };
  }

  if (activeCount === 0) {
    return {
      line: `${inactiveCount} неактивных назначений. Активных курсов нет.`,
      supporting: "Если появится новое назначение — добавьте, чтобы я учитывал.",
    };
  }

  // Has active meds — focus on today's intake
  const allTaken = takenTodayCount >= activeCount;
  const noneTaken = takenTodayCount === 0;

  if (allTaken) {
    return {
      line: `${activeCount} активных, все приёмы за сегодня отмечены.`,
    };
  }

  if (noneTaken) {
    return {
      line: `${activeCount} активных назначений. Приёмы за сегодня пока не отмечены.`,
    };
  }

  const remaining = activeCount - takenTodayCount;
  return {
    line: `${activeCount} активных. Отмечено ${takenTodayCount}, осталось ${remaining}.`,
  };
}

// === Post-save reaction (client-side) ===

export interface MedReaction {
  line: string;
  supporting?: string;
}

interface MedReactionContext {
  name: string;
  hasDosage: boolean;
  hasSchedule: boolean;
  isFirstMed: boolean;
}

export function medPostSaveReaction(ctx: MedReactionContext): MedReaction {
  if (ctx.isFirstMed) {
    return {
      line: `Принял. ${ctx.name} — первое назначение на месте.`,
      supporting: "Буду учитывать при анализе.",
    };
  }

  if (ctx.hasDosage && ctx.hasSchedule) {
    return {
      line: `Принял. ${ctx.name} с дозировкой и расписанием — всё учтено.`,
    };
  }

  if (ctx.hasDosage) {
    return {
      line: `Принял. ${ctx.name} добавлен.`,
      supporting: "Расписание можно уточнить позже.",
    };
  }

  return {
    line: `Принял. ${ctx.name} в списке назначений.`,
  };
}
