"use client";

import { useState } from "react";

export interface SymptomEntry {
  name: string;
  started_at_text: string;
  duration_text: string;
  frequency: string;
  intensity: string;
  triggers: string;
  associated_symptoms: string;
  functional_impact: string;
}

const EMPTY: SymptomEntry = {
  name: "", started_at_text: "", duration_text: "", frequency: "",
  intensity: "", triggers: "", associated_symptoms: "", functional_impact: "",
};

const labelStyle = { color: "var(--text-muted)" };
const inputStyle = { backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" };

export function StructuredSymptomInput({
  value,
  onChange,
}: {
  value: SymptomEntry[];
  onChange: (v: SymptomEntry[]) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  function add() {
    const next = [...value, { ...EMPTY }];
    onChange(next);
    setExpanded(next.length - 1);
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
    setExpanded(null);
  }

  function update(i: number, field: keyof SymptomEntry, v: string) {
    const next = [...value];
    next[i] = { ...next[i], [field]: v };
    onChange(next);
  }

  const inputClass = "w-full rounded-lg px-3 py-1.5 text-[12px] transition-all focus:outline-none focus:ring-1 focus:ring-accent-muted";

  return (
    <div>
      {value.map((s, i) => (
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
              style={{ color: s.name ? "var(--text-primary)" : "var(--text-muted)" }}
            >
              {s.name || "Новый симптом"}
            </button>
            <button type="button" onClick={() => remove(i)} className="text-[10px] shrink-0" style={{ color: "var(--amber)" }}>
              Удалить
            </button>
          </div>

          {expanded === i && (
            <div className="mt-2 space-y-2">
              <div>
                <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>Название</label>
                <input value={s.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Головная боль" className={inputClass} style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>Когда началось</label>
                  <input value={s.started_at_text} onChange={(e) => update(i, "started_at_text", e.target.value)} placeholder="Вчера утром" className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>Длительность</label>
                  <input value={s.duration_text} onChange={(e) => update(i, "duration_text", e.target.value)} placeholder="2-3 часа" className={inputClass} style={inputStyle} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>Частота</label>
                  <input value={s.frequency} onChange={(e) => update(i, "frequency", e.target.value)} placeholder="Ежедневно" className={inputClass} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>Интенсивность</label>
                  <input value={s.intensity} onChange={(e) => update(i, "intensity", e.target.value)} placeholder="Умеренная" className={inputClass} style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>Триггеры</label>
                <input value={s.triggers} onChange={(e) => update(i, "triggers", e.target.value)} placeholder="Стресс, недосып, еда" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>Сопутствующие симптомы</label>
                <input value={s.associated_symptoms} onChange={(e) => update(i, "associated_symptoms", e.target.value)} placeholder="Тошнота, головокружение" className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-[10px] font-medium mb-0.5" style={labelStyle}>Влияние на функционирование</label>
                <input value={s.functional_impact} onChange={(e) => update(i, "functional_impact", e.target.value)} placeholder="Не могу работать" className={inputClass} style={inputStyle} />
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="text-[11px] font-medium transition-colors hover:brightness-90"
        style={{ color: "var(--accent)" }}
      >
        + Добавить симптом
      </button>
    </div>
  );
}
