"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { generateHealthSummary } from "./summary-action";

const CACHE_PREFIX = "medhub_health_summary_";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CachedSummary {
  text: string;
  ts: number;
}

export function AiSummary({ patientId }: { patientId: string }) {
  const CACHE_KEY = CACHE_PREFIX + patientId;
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);

  // Load cached summary on mount (or when patientId changes)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: CachedSummary = JSON.parse(raw);
        if (Date.now() - cached.ts < CACHE_TTL) {
          setSummary(cached.text);
          return;
        }
        // Stale cache — show it but mark as stale
        setSummary(cached.text);
        setStale(true);
      }
    } catch {
      // ignore
    }
  }, [CACHE_KEY]);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const text = await generateHealthSummary();
      setSummary(text);
      setStale(false);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ text, ts: Date.now() }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось получить сводку");
    } finally {
      setLoading(false);
    }
  }

  // No cached summary — show CTA
  if (!summary && !loading && !error) {
    return (
      <div className="rounded-2xl card p-5">
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Краткая сводка состояния
        </h3>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Я проанализирую ваши данные и расскажу, что вижу
        </p>
        <button
          type="button"
          onClick={generate}
          className="mt-3 rounded-xl px-4 py-2 text-sm font-medium transition hover:shadow-md"
          style={{ backgroundColor: "var(--accent)", color: "var(--bg-primary)" }}
        >
          Получить сводку
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Краткая сводка состояния
        </h3>
        {summary && !loading && (
          <button
            type="button"
            onClick={generate}
            className="text-xs font-medium transition hover:underline"
            style={{ color: "var(--accent)" }}
          >
            Обновить
          </button>
        )}
      </div>

      {loading && (
        <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>
          Анализирую ваши данные...
        </p>
      )}

      {error && (
        <div className="mt-3">
          <p className="text-sm" style={{ color: "var(--amber)" }}>{error}</p>
          <button
            type="button"
            onClick={generate}
            className="mt-2 text-xs font-medium"
            style={{ color: "var(--accent)" }}
          >
            Попробовать снова
          </button>
        </div>
      )}

      {summary && !loading && (
        <div className="mt-3 space-y-2">
          {summary.split("\n\n").filter(Boolean).map((paragraph, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed"
              style={{ color: i === 2 ? "var(--text-muted)" : "var(--text-primary)" }}
            >
              {paragraph}
            </p>
          ))}
          {stale && (
            <p className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
              Сводка обновлялась более 24ч назад
            </p>
          )}
          {/* Evidence links */}
          <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <Link href="/records" className="text-xs font-medium" style={{ color: "var(--accent)" }}>
              Записи →
            </Link>
            <Link href="/documents" className="text-xs font-medium" style={{ color: "var(--accent)" }}>
              Документы →
            </Link>
            <Link href="/doctor-visit" className="text-xs font-medium" style={{ color: "var(--accent)" }}>
              Врач →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
