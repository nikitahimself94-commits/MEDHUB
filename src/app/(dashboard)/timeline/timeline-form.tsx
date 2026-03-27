"use client";

import { useState } from "react";
import { createTimelineEvent } from "./actions";

const EVENT_TYPES = [
  { value: "doctor_visit", label: "Визит к врачу" },
  { value: "analysis", label: "Анализ" },
  { value: "procedure", label: "Процедура" },
  { value: "hospitalization", label: "Госпитализация" },
  { value: "treatment_change", label: "Изменение лечения" },
  { value: "other", label: "Другое" },
] as const;

const labelStyle = { color: "var(--text-muted)" };
const inputStyle = { backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" };

export function TimelineForm() {
  const [open, setOpen] = useState(false);
  const [eventType, setEventType] = useState<string>(EVENT_TYPES[0].value);
  const [eventDate, setEventDate] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Заголовок обязателен");
      return;
    }
    if (!eventDate) {
      setError("Дата обязательна");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");

    const formData = new FormData();
    formData.set("event_type", eventType);
    formData.set("event_date", eventDate);
    formData.set("title", title.trim());
    formData.set("notes", notes);

    try {
      await createTimelineEvent(formData);
      setSaved(true);
      setTitle("");
      setEventDate("");
      setNotes("");
      setOpen(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "block text-sm font-medium mb-1";
  const inputClass =
    "w-full rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent-muted focus:border-accent";

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => { setSaved(false); setError(""); setOpen(true); }}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-gray-900 hover:brightness-90"
        >
          + Добавить событие
        </button>
        {saved && <span className="text-sm text-accent">Сохранено</span>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Новое событие</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm" style={{ color: "var(--text-muted)" }}
        >
          Отмена
        </button>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Тип события</label>
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className={inputClass}
          style={inputStyle}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Дата *</label>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Заголовок *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Приём у терапевта, ОАК, МРТ..."
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Заметка</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Подробности, результаты..."
          className={inputClass}
          style={inputStyle}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-gray-900 hover:brightness-90 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
        {saved && <span className="text-sm text-accent">Сохранено</span>}
        {error && <span className="text-sm" style={{ color: "var(--amber)" }}>{error}</span>}
      </div>
    </form>
  );
}
