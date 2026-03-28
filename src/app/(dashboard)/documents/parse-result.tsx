import type { DocumentParse } from "@/types/database";

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  норма: { bg: "rgba(45,212,191,0.10)", color: "var(--accent)" },
  повышен: { bg: "rgba(245,158,11,0.10)", color: "var(--amber)" },
  понижен: { bg: "rgba(245,158,11,0.10)", color: "var(--amber)" },
  внимание: { bg: "rgba(245,158,11,0.10)", color: "var(--amber)" },
};

const fallbackStyle = { bg: "rgba(255,255,255,0.05)", color: "var(--text-muted)" };

export function ParseResult({ parse }: { parse: DocumentParse }) {
  // Compact metadata line
  const metaParts = [parse.doc_type, parse.lab_or_clinic];
  if (parse.doc_date) {
    metaParts.push(new Date(parse.doc_date + "T00:00:00").toLocaleDateString("ru-RU"));
  }
  const metaLine = metaParts.filter(Boolean).join(" · ");

  return (
    <div className="rounded-xl p-4" style={{ border: "1px solid rgba(45,212,191,0.15)", backgroundColor: "rgba(45,212,191,0.04)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--accent)" }}>
          AI-разбор
        </p>
        <p className="text-[10px] shrink-0" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
          {new Date(parse.created_at).toLocaleString("ru-RU")}
        </p>
      </div>

      {metaLine && (
        <p className="mt-2 text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
          {metaLine}
        </p>
      )}

      {parse.key_findings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {parse.key_findings.map((f, i) => {
            const st = (f.status ? STATUS_STYLE[f.status] : null) || fallbackStyle;
            return (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
              >
                <span className="flex-1 text-[13px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {f.name}
                </span>
                <span className="shrink-0 text-[13px]" style={{ color: "var(--text-muted)" }}>
                  {f.value}
                </span>
                {f.status && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: st.bg, color: st.color }}
                  >
                    {f.status}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {parse.summary && (
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {parse.summary}
        </p>
      )}
    </div>
  );
}
