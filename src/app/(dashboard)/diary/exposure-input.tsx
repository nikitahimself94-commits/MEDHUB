"use client";

import { useState } from "react";

export interface ExposureEntry {
  type: string;
  details: string;
}

const EXPOSURE_TYPES: { value: string; label: string }[] = [
  { value: "food", label: "Еда / продукт" },
  { value: "new_medication", label: "Новый препарат" },
  { value: "infection", label: "Инфекция / контакт" },
  { value: "stress", label: "Стресс" },
  { value: "sleep_loss", label: "Недосып" },
  { value: "physical_load", label: "Физическая нагрузка" },
  { value: "allergen_environment", label: "Аллерген / среда" },
  { value: "travel", label: "Поездка" },
  { value: "cycle", label: "Цикл / гормоны" },
  { value: "other", label: "Другое" },
];

const labelStyle = { color: "var(--text-muted)" };
const inputStyle = { backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" };

export function ExposureInput({
  value,
  onChange,
}: {
  value: ExposureEntry[];
  onChange: (v: ExposureEntry[]) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  function add() {
    const next = [...value, { type: "other", details: "" }];
    onChange(next);
    setExpanded(next.length - 1);
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
    setExpanded(null);
  }

  function update(i: number, field: keyof ExposureEntry, v: string) {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  }

  const inputClass = "w-full rounded-lg px-3 py-1.5 text-[12px] transition-all focus:outline-none focus:ring-1 focus:ring-accent-muted";

  return (
    <div>
      {value.map((e, i) => {
        const typeLabel = EXPOSURE_TYPES.find(t => t.value === e.type)?.label ?? e.type;
        return (
          <div
            key={i}
            className="mb-2 rounded-lg px-3 py-2"
            style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="text-[12px] font-medium text-left flex-1 truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {typeLabel}{e.details ? `: ${e.details}` : ""}
              </button>
              <button type="button" onClick={() => remove(i)} className="text-[10px] shrink-0" style={{ color: "var(--amber)" }}>
                Удалить
              </button>
            </div>

            {expanded === i && (
              <div className="mt-2 space-y-2">
                <div>
                  <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>Тип</label>
                  <select value={e.type} onChange={(ev) => update(i, "type", ev.target.value)} className={inputClass} style={inputStyle}>
                    {EXPOSURE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>Детали</label>
                  <input value={e.details} onChange={(ev) => update(i, "details", ev.target.value)} placeholder="Что именно, когда, сколько" className={inputClass} style={inputStyle} />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="text-[11px] font-medium transition-colors hover:brightness-90"
        style={{ color: "var(--accent)" }}
      >
        + Добавить триггер
      </button>
    </div>
  );
}
