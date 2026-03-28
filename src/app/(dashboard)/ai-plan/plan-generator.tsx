"use client";

import { useState } from "react";
import { generateHealthPlan } from "./actions";

export function PlanGenerator() {
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      const result = await generateHealthPlan();
      setPlan(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка генерации плана");
    } finally {
      setLoading(false);
    }
  }

  if (!plan) {
    return (
      <div className="mt-6">
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: "rgba(45,212,191,0.04)", border: "1px solid rgba(45,212,191,0.12)" }}
        >
          <p className="text-[15px] font-medium" style={{ color: "var(--text-primary)" }}>
            AI проанализирует ваши данные и составит план наблюдения на 2 недели.
          </p>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
            На основе дневника, показателей, лекарств и документов — что отслеживать, на что обратить внимание, о чём спросить врача.
          </p>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className={`mt-4 rounded-full px-6 py-2.5 text-[14px] font-semibold transition-all ${
              loading ? "animate-pulse" : "hover:brightness-110 active:scale-[0.97]"
            }`}
            style={{
              backgroundColor: "rgba(45,212,191,0.12)",
              color: "var(--accent)",
              border: "1px solid rgba(45,212,191,0.25)",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Генерирую план..." : "Сгенерировать план"}
          </button>

          {error && (
            <p className="mt-3 text-[13px]" style={{ color: "var(--amber)" }}>{error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <PlanResult markdown={plan} />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className={`rounded-full px-5 py-2 text-[13px] font-semibold transition-all ${
            loading ? "animate-pulse" : "hover:brightness-110 active:scale-[0.97]"
          }`}
          style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "var(--text-muted)",
            border: "1px solid rgba(255,255,255,0.10)",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Обновляю..." : "Обновить план"}
        </button>
        {error && (
          <span className="text-[12px]" style={{ color: "var(--amber)" }}>{error}</span>
        )}
      </div>
    </div>
  );
}

function PlanResult({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");

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
    <div
      className="rounded-xl p-5"
      style={{ border: "1px solid rgba(45,212,191,0.15)", backgroundColor: "rgba(45,212,191,0.03)" }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--accent)" }}>
        План наблюдения · 2 недели
      </p>

      <div className="mt-4 space-y-0">
        {sections.map((section, si) => {
          const hasBullets = section.content.some(
            (node) => node !== null && typeof node === "object" && "type" in (node as React.ReactElement) && (node as React.ReactElement).type === "li"
          );
          return (
            <div
              key={si}
              className={si > 0 ? "pt-4 mt-4" : ""}
              style={si > 0 ? { borderTop: "1px solid rgba(255,255,255,0.06)" } : undefined}
            >
              {section.title && (
                <p className="text-[14px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
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
