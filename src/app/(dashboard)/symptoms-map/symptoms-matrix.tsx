"use client";

import { useState } from "react";

interface SerializedProps {
  data14: Record<string, string[]>;
  data30: Record<string, string[]>;
  days14: string[];
  days30: string[];
}

function formatDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export function SymptomsMatrix({ data14, data30, days14, days30 }: SerializedProps) {
  const [period, setPeriod] = useState<14 | 30>(14);

  const data = period === 14 ? data14 : data30;
  const days = period === 14 ? days14 : days30;
  const symptoms = Object.keys(data).sort();

  const hasData = symptoms.length > 0;

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setPeriod(14)}
          className={`rounded px-3 py-1.5 text-sm ${
            period === 14
              ? "bg-accent font-medium text-gray-900"
              : "hover:brightness-110"
          }`}
          style={
            period === 14
              ? undefined
              : { backgroundColor: "var(--bg-surface-hover)", color: "var(--text-muted)" }
          }
        >
          14 дней
        </button>
        <button
          type="button"
          onClick={() => setPeriod(30)}
          className={`rounded px-3 py-1.5 text-sm ${
            period === 30
              ? "bg-accent font-medium text-gray-900"
              : "hover:brightness-110"
          }`}
          style={
            period === 30
              ? undefined
              : { backgroundColor: "var(--bg-surface-hover)", color: "var(--text-muted)" }
          }
        >
          30 дней
        </button>
      </div>

      {!hasData && (
        <p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Нет симптомов за выбранный период
        </p>
      )}

      {hasData && (
        <div className="overflow-x-auto rounded" style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th
                  className="sticky left-0 px-3 py-2 text-left text-xs font-medium"
                  style={{ backgroundColor: "var(--bg-surface-hover)", color: "var(--text-muted)" }}
                >
                  Симптом
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className="px-1.5 py-2 text-center text-xs font-normal"
                    style={{ backgroundColor: "var(--bg-surface-hover)", color: "var(--text-muted)" }}
                  >
                    {formatDay(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symptoms.map((symptom) => {
                const daySet = data[symptom];
                return (
                  <tr key={symptom} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td
                      className="sticky left-0 px-3 py-2 text-sm font-medium"
                      style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-muted)" }}
                    >
                      {symptom}
                    </td>
                    {days.map((d) => {
                      const present = daySet.includes(d);
                      return (
                        <td key={d} className="px-1.5 py-2 text-center">
                          {present ? (
                            <span className="inline-block h-4 w-4 rounded bg-amber" />
                          ) : (
                            <span className="inline-block h-4 w-4 rounded" style={{ backgroundColor: "var(--bg-surface-hover)" }} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
