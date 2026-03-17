import type { DocumentOpinion } from "@/types/database";

export function OpinionResult({ opinion }: { opinion: DocumentOpinion }) {
  const lines = opinion.opinion.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      elements.push(
        <h4 key={i} className="mt-3 mb-1 text-sm font-semibold text-slate-800">
          {line.slice(3)}
        </h4>
      );
    } else if (line.startsWith("- ")) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm text-gray-700">
          {line.slice(2)}
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-gray-700">{line}</p>
      );
    }
  }

  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        Второе мнение
      </p>
      <div className="mt-1">{elements}</div>
      <p className="mt-2 text-xs text-gray-400">
        Сгенерировано {new Date(opinion.created_at).toLocaleString("ru-RU")}
      </p>
    </div>
  );
}
