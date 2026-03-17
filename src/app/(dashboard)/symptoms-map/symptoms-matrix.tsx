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
              ? "bg-brand-600 font-medium text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          14 дней
        </button>
        <button
          type="button"
          onClick={() => setPeriod(30)}
          className={`rounded px-3 py-1.5 text-sm ${
            period === 30
              ? "bg-brand-600 font-medium text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          30 дней
        </button>
      </div>

      {!hasData && (
        <p className="py-8 text-center text-sm text-gray-400">
          Нет симптомов за выбранный период
        </p>
      )}

      {hasData && (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left text-xs font-medium text-gray-500">
                  Симптом
                </th>
                {days.map((d) => (
                  <th
                    key={d}
                    className="px-1.5 py-2 text-center text-xs font-normal text-gray-400"
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
                  <tr key={symptom} className="border-b last:border-b-0">
                    <td className="sticky left-0 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                      {symptom}
                    </td>
                    {days.map((d) => {
                      const present = daySet.includes(d);
                      return (
                        <td key={d} className="px-1.5 py-2 text-center">
                          {present ? (
                            <span className="inline-block h-4 w-4 rounded bg-red-400" />
                          ) : (
                            <span className="inline-block h-4 w-4 rounded bg-gray-100" />
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
