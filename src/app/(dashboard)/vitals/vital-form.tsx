"use client";

import { useState } from "react";
import { createVital } from "./actions";
import { vitalsPostSaveReaction, type VitalsReaction } from "./vitals-reaction";

const VITAL_TYPES = [
  { value: "blood_pressure", label: "Давление", unit: "мм рт.ст.", placeholder: "120/80", notePlaceholder: "Сидя, стоя, после нагрузки..." },
  { value: "pulse", label: "Пульс", unit: "уд/мин", placeholder: "72", notePlaceholder: "В покое, после нагрузки, при стрессе..." },
  { value: "temperature", label: "Температура", unit: "°C", placeholder: "36.6", notePlaceholder: "Утро, вечер, при недомогании..." },
  { value: "spo2", label: "SpO2", unit: "%", placeholder: "98", notePlaceholder: "В покое, после ходьбы..." },
  { value: "weight", label: "Вес", unit: "кг", placeholder: "70", notePlaceholder: "Утром натощак, вечером..." },
  { value: "glucose", label: "Глюкоза", unit: "ммоль/л", placeholder: "5.5", notePlaceholder: "Натощак, после еды, перед сном..." },
] as const;

export function VitalForm({ entryCount }: { entryCount: number }) {
  const [open, setOpen] = useState(false);
  const [vitalType, setVitalType] = useState<string>(VITAL_TYPES[0].value);
  const [value, setValue] = useState("");
  const [measuredAt, setMeasuredAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reaction, setReaction] = useState<VitalsReaction | null>(null);
  const [error, setError] = useState("");

  const selected = VITAL_TYPES.find((t) => t.value === vitalType) ?? VITAL_TYPES[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      setError("Значение обязательно");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");

    const formData = new FormData();
    formData.set("vital_type", vitalType);
    formData.set("value", value.trim());
    formData.set("unit", selected.unit);
    if (measuredAt) {
      formData.set("measured_at", new Date(measuredAt).toISOString());
    }
    formData.set("notes", notes);

    try {
      await createVital(formData);

      // Compute agent reaction from just-submitted data before resetting
      const submittedValue = value.trim();
      const r = vitalsPostSaveReaction({
        vitalType,
        vitalLabel: selected.label,
        value: submittedValue,
        isFirstEntry: entryCount === 0,
      });
      setReaction(r);

      setSaved(true);
      setValue("");
      setMeasuredAt("");
      setNotes("");
      setOpen(false);
      setTimeout(() => { setSaved(false); setReaction(null); }, 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white/60 px-4 py-2.5 text-sm transition-all focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/10";

  if (!open) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setSaved(false); setReaction(null); setError(""); setOpen(true); }}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            + Добавить показатель
          </button>
        </div>
        {saved && reaction && (
          <div
            className="mt-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: "rgba(45,110,106,0.06)" }}
          >
            <p className="text-[13px] font-medium" style={{ color: "#1A2F2B" }}>
              {reaction.line}
            </p>
            {reaction.supporting && (
              <p className="mt-0.5 text-[12px]" style={{ color: "#5A8F85" }}>
                {reaction.supporting}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Новый показатель</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Отмена
        </button>
      </div>

      <div>
        <label className={labelClass}>Тип показателя</label>
        <select
          value={vitalType}
          onChange={(e) => setVitalType(e.target.value)}
          className={inputClass}
        >
          {VITAL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label} ({t.unit})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Значение *</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={selected.placeholder}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Время измерения</label>
        <input
          type="datetime-local"
          value={measuredAt}
          onChange={(e) => setMeasuredAt(e.target.value)}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-400">Если не указано — текущее время</p>
      </div>

      <div>
        <label className={labelClass}>Заметка</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={selected.notePlaceholder}
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
        {saved && reaction && (
          <span className="text-sm" style={{ color: "#2D6E6A" }}>{reaction.line}</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
