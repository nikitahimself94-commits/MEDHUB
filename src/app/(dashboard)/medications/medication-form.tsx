"use client";

import { useState } from "react";
import { createMedication } from "./actions";
import { medPostSaveReaction, type MedReaction } from "./medications-companion";

export function MedicationForm({ medCount }: { medCount: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [schedule, setSchedule] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [purpose, setPurpose] = useState("");
  const [effect, setEffect] = useState("");
  const [sideEffects, setSideEffects] = useState("");
  const [therapyChanges, setTherapyChanges] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reaction, setReaction] = useState<MedReaction | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Название обязательно");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");

    const formData = new FormData();
    formData.set("name", name);
    formData.set("dosage", dosage);
    formData.set("schedule", schedule);
    formData.set("start_date", startDate);
    formData.set("end_date", endDate);
    formData.set("active", String(active));
    formData.set("notes", notes);
    formData.set("purpose", purpose);
    formData.set("effect", effect);
    formData.set("side_effects", sideEffects);
    formData.set("therapy_changes", therapyChanges);

    try {
      await createMedication(formData);

      const r = medPostSaveReaction({
        name: name.trim(),
        hasDosage: dosage.trim().length > 0,
        hasSchedule: schedule.trim().length > 0,
        isFirstMed: medCount === 0,
      });
      setReaction(r);

      setSaved(true);
      setName("");
      setDosage("");
      setSchedule("");
      setEndDate("");
      setActive(true);
      setNotes("");
      setPurpose("");
      setEffect("");
      setSideEffects("");
      setTherapyChanges("");
      setOpen(false);
      setTimeout(() => { setSaved(false); setReaction(null); }, 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "block text-sm font-medium mb-1";
  const labelStyle = { color: "var(--text-muted)" } as const;
  const inputClass =
    "w-full rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent-muted focus:border-accent";
  const inputStyle = { backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" } as const;

  if (!open) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setSaved(false); setReaction(null); setError(""); setOpen(true); }}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium hover:brightness-90"
            style={{ color: "var(--bg-primary)" }}
          >
            + Добавить препарат
          </button>
        </div>
        {saved && reaction && (
          <div
            className="mt-3 rounded-xl px-4 py-3"
            style={{ backgroundColor: "var(--accent-muted)" }}
          >
            <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>
              {reaction.line}
            </p>
            {reaction.supporting && (
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
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
        <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Новый препарат</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm hover:brightness-110"
          style={{ color: "var(--text-muted)" }}
        >
          Отмена
        </button>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Название *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Метформин"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>Дозировка</label>
          <input
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="500 мг"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Расписание / Как принимать</label>
          <input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="2 раза в день после еды"
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>Дата начала</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Дата окончания</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded"
          style={{ borderColor: "var(--border)" }}
        />
        <label htmlFor="active" className="text-sm" style={{ color: "var(--text-muted)" }}>
          Активный препарат
        </label>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Заметка</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Принимать строго с едой, не сочетать с алкоголем..."
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Назначение / Цель приёма</label>
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Для снижения давления" className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Эффект</label>
        <input value={effect} onChange={(e) => setEffect(e.target.value)} placeholder="Давление снизилось, стало стабильнее" className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Побочные эффекты</label>
        <input value={sideEffects} onChange={(e) => setSideEffects(e.target.value)} placeholder="Сухой кашель, головокружение" className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Изменения в терапии</label>
        <textarea value={therapyChanges} onChange={(e) => setTherapyChanges(e.target.value)} rows={2} placeholder="Доза увеличена с 5мг до 10мг, 15.03.2026" className={inputClass} style={inputStyle} />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium hover:brightness-90 disabled:opacity-50"
          style={{ color: "var(--bg-primary)" }}
        >
          {saving ? "Сохранение..." : "Сохранить препарат"}
        </button>
        {saved && reaction && (
          <span className="text-sm" style={{ color: "var(--accent)" }}>{reaction.line}</span>
        )}
        {error && <span className="text-sm" style={{ color: "var(--amber)" }}>{error}</span>}
      </div>
    </form>
  );
}
