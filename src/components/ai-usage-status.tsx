import { AI_MONTHLY_LIMIT } from "@/lib/check-ai-quota";

interface AiUsageStatusProps {
  used: number;
}

export function AiUsageStatus({ used }: AiUsageStatusProps) {
  const remaining = Math.max(0, AI_MONTHLY_LIMIT - used);
  const pct = Math.min(100, Math.round((used / AI_MONTHLY_LIMIT) * 100));
  const isWarning = pct >= 80;
  const isExhausted = remaining === 0;

  const barColor = isExhausted
    ? "var(--amber)"
    : isWarning
      ? "var(--amber)"
      : "var(--accent)";

  const textColor = isExhausted
    ? "var(--amber)"
    : isWarning
      ? "var(--amber)"
      : "var(--text-muted)";

  return (
    <div
      className="rounded-xl px-4 py-2.5"
      style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: textColor }}>
          {isExhausted
            ? "Лимит AI-запросов исчерпан"
            : `AI-запросы: ${used} из ${AI_MONTHLY_LIMIT} за 30 дней`}
        </span>
        <span className="font-medium" style={{ color: textColor }}>
          {isExhausted ? "0" : remaining} осталось
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full rounded-full"
        style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}
