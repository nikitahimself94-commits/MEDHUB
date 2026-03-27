import type { DocumentParse } from "@/types/database";

const STATUS_COLORS: Record<string, React.CSSProperties> = {
  норма: { color: "var(--accent)" },
  повышен: { color: "var(--amber)" },
  понижен: { color: "var(--amber)" },
  внимание: { color: "var(--amber)" },
};

const fallbackStyle: React.CSSProperties = { color: "var(--text-muted)" };

export function ParseResult({ parse }: { parse: DocumentParse }) {
  return (
    <div className="mt-3 rounded p-3" style={{ border: "1px solid var(--border)", backgroundColor: "var(--accent-muted)" }}>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        AI-разбор
      </p>

      <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--text-primary)" }}>
        {parse.doc_type && (
          <p><span className="font-medium" style={{ color: "var(--text-muted)" }}>Тип:</span> {parse.doc_type}</p>
        )}
        {parse.doc_date && (
          <p><span className="font-medium" style={{ color: "var(--text-muted)" }}>Дата:</span> {new Date(parse.doc_date + "T00:00:00").toLocaleDateString("ru-RU")}</p>
        )}
        {parse.lab_or_clinic && (
          <p><span className="font-medium" style={{ color: "var(--text-muted)" }}>Лаборатория/клиника:</span> {parse.lab_or_clinic}</p>
        )}
      </div>

      {parse.key_findings.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Ключевые показатели:</p>
          <ul className="mt-1 space-y-0.5">
            {parse.key_findings.map((f, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{f.name}:</span>{" "}
                {f.value}
                {f.status && (
                  <span className="ml-1 text-xs font-medium" style={STATUS_COLORS[f.status] || fallbackStyle}>
                    ({f.status})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {parse.summary && (
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{parse.summary}</p>
      )}

      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        Разбор от {new Date(parse.created_at).toLocaleString("ru-RU")}
      </p>
    </div>
  );
}
