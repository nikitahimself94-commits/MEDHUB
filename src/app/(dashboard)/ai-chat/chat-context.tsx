export interface DataLayer {
  label: string;
  available: boolean;
}

export function ChatContext({ layers }: { layers: DataLayer[] }) {
  const filled = layers.filter((l) => l.available);
  const total = layers.length;

  let evidenceNote: string;
  let evidenceColor: string;

  if (filled.length === 0) {
    evidenceNote = "Пока нет данных — ответы будут общими. Добавьте хотя бы один документ или запись, чтобы агент мог опираться на вашу ситуацию.";
    evidenceColor = "var(--text-muted)";
  } else if (filled.length <= 2) {
    evidenceNote = `Контекст частичный (${filled.length} из ${total}) — ответы точнее, когда заполнено больше слоёв.`;
    evidenceColor = "var(--amber)";
  } else {
    evidenceNote = `Хорошее покрытие (${filled.length} из ${total}) — агент опирается на реальную картину.`;
    evidenceColor = "var(--accent)";
  }

  return (
    <div className="rounded-2xl card p-5">
      <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
        Ваш AI-помощник
      </p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
        Отвечает на основе ваших данных — не в пустоту
      </p>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Видит:</span>
        {layers.map((l) => (
          <span
            key={l.label}
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: l.available ? "var(--accent)" : "var(--text-muted)" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: l.available ? "var(--accent)" : "var(--border)" }}
            />
            {l.label}
          </span>
        ))}
      </div>

      <p className="mt-2.5 text-xs" style={{ color: evidenceColor }}>
        {evidenceNote}
      </p>
    </div>
  );
}
