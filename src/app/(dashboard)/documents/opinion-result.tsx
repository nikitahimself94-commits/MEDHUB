import type { DocumentOpinion } from "@/types/database";

export function OpinionResult({ opinion }: { opinion: DocumentOpinion }) {
  const lines = opinion.opinion.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      elements.push(
        <h4 key={i} className="mt-3 mb-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {line.slice(3)}
        </h4>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm" style={{ color: "var(--text-muted)" }}>
          {line.slice(2)}
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(
        <p key={i} className="text-sm" style={{ color: "var(--text-muted)" }}>{line}</p>
      );
    }
  }

  return (
    <div className="mt-3 rounded p-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-hover)" }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        Второе мнение
      </p>
      <div className="mt-1">{elements}</div>
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        Сгенерировано {new Date(opinion.created_at).toLocaleString("ru-RU")}
      </p>
    </div>
  );
}
