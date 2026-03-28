import type { DocumentOpinion } from "@/types/database";

export function OpinionResult({ opinion }: { opinion: DocumentOpinion }) {
  const lines = opinion.opinion.split("\n");

  // Group lines into sections (split on ## headers)
  const sections: Array<{ title: string | null; content: React.ReactNode[] }> = [];
  let current: { title: string | null; content: React.ReactNode[] } = { title: null, content: [] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      if (current.title !== null || current.content.length > 0) {
        sections.push(current);
      }
      current = { title: line.slice(3), content: [] };
    } else if (line.startsWith("- ")) {
      current.content.push(
        <li key={i} className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {line.slice(2)}
        </li>
      );
    } else if (line.trim() !== "") {
      current.content.push(
        <p key={i} className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>{line}</p>
      );
    }
  }
  if (current.title !== null || current.content.length > 0) {
    sections.push(current);
  }

  return (
    <div className="rounded-xl p-4" style={{ border: "1px solid rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--text-muted)" }}>
          Второе мнение
        </p>
        <p className="text-[10px] shrink-0" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
          {new Date(opinion.created_at).toLocaleString("ru-RU")}
        </p>
      </div>

      <div className="mt-3 space-y-0">
        {sections.map((section, si) => {
          const hasBullets = section.content.some(
            (node) => node !== null && typeof node === "object" && "type" in (node as React.ReactElement) && (node as React.ReactElement).type === "li"
          );
          return (
            <div
              key={si}
              className={si > 0 ? "pt-3 mt-3" : ""}
              style={si > 0 ? { borderTop: "1px solid rgba(255,255,255,0.06)" } : undefined}
            >
              {section.title && (
                <p className="text-[13px] font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
                  {section.title}
                </p>
              )}
              {hasBullets ? (
                <ul
                  className="space-y-1 pl-3 list-disc marker:text-accent/30"
                  style={{ borderLeft: "2px solid rgba(45,212,191,0.12)" }}
                >
                  {section.content}
                </ul>
              ) : (
                <div className="space-y-1">{section.content}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
