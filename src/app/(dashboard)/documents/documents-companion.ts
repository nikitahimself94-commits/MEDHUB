// ---------------------------------------------------------------------------
// Documents companion block — deterministic agent state inside /documents.
// No AI calls. Adapts to empty / initial / populated states.
// ---------------------------------------------------------------------------

export interface DocsCompanion {
  line: string;
  supporting?: string;
}

interface DocsContext {
  totalDocs: number;
  parsedCount: number;
  opinionCount: number;
}

export function documentsCompanion(ctx: DocsContext): DocsCompanion {
  const { totalDocs, parsedCount, opinionCount } = ctx;

  // Empty — no documents at all
  if (totalDocs === 0) {
    return {
      line: "Здесь пока пусто. Один документ — и мне будет с чем работать.",
      supporting: "Подойдёт анализ, выписка, заключение — даже фото на телефон.",
    };
  }

  // Has documents but none parsed yet
  if (parsedCount === 0) {
    if (totalDocs === 1) {
      return {
        line: "Документ на месте. Могу разобрать содержание простым языком.",
      };
    }
    return {
      line: `${totalDocs} документа загружено. Ни один пока не разобран — могу начать.`,
    };
  }

  // Some parsed, could get second opinion
  const unparsed = totalDocs - parsedCount;
  const noOpinion = parsedCount - opinionCount;

  if (totalDocs <= 2) {
    // Initial state — small collection
    if (unparsed > 0) {
      return {
        line: `Разобрано ${parsedCount} из ${totalDocs}. Есть что ещё разобрать.`,
      };
    }
    if (noOpinion > 0) {
      return {
        line: "Документы разобраны. Могу дать второе мнение — на что обратить внимание.",
      };
    }
    return {
      line: "Начало положено. Следующий документ сделает анализ точнее.",
    };
  }

  // Populated state — 3+ documents
  if (unparsed > 0) {
    return {
      line: `${parsedCount} из ${totalDocs} разобрано. Остались неразобранные.`,
    };
  }

  if (noOpinion > 0) {
    return {
      line: `Все ${totalDocs} документов разобраны. Для ${noOpinion} ещё нет второго мнения.`,
    };
  }

  // Fully processed
  return {
    line: `${totalDocs} документов, все разобраны и проверены. Хорошая база.`,
  };
}
