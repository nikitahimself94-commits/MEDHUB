import type { DocumentParse } from "@/types/database";

const STATUS_COLORS: Record<string, string> = {
  норма: "text-teal-600",
  повышен: "text-red-600",
  понижен: "text-yellow-700",
  внимание: "text-amber-600",
};

export function ParseResult({ parse }: { parse: DocumentParse }) {
  return (
    <div className="mt-3 rounded border border-brand-100 bg-brand-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
        AI-разбор
      </p>

      <div className="mt-2 space-y-1 text-sm text-gray-800">
        {parse.doc_type && (
          <p><span className="font-medium text-gray-500">Тип:</span> {parse.doc_type}</p>
        )}
        {parse.doc_date && (
          <p><span className="font-medium text-gray-500">Дата:</span> {new Date(parse.doc_date + "T00:00:00").toLocaleDateString("ru-RU")}</p>
        )}
        {parse.lab_or_clinic && (
          <p><span className="font-medium text-gray-500">Лаборатория/клиника:</span> {parse.lab_or_clinic}</p>
        )}
      </div>

      {parse.key_findings.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-gray-500">Ключевые показатели:</p>
          <ul className="mt-1 space-y-0.5">
            {parse.key_findings.map((f, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{f.name}:</span>{" "}
                {f.value}
                {f.status && (
                  <span className={`ml-1 text-xs font-medium ${STATUS_COLORS[f.status] || "text-gray-500"}`}>
                    ({f.status})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {parse.summary && (
        <p className="mt-2 text-sm text-gray-700">{parse.summary}</p>
      )}

      <p className="mt-2 text-xs text-gray-400">
        Разбор от {new Date(parse.created_at).toLocaleString("ru-RU")}
      </p>
    </div>
  );
}
