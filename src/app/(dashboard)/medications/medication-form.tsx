"use client";

import { useState } from "react";
import { createMedication } from "./actions";

export function MedicationForm() {
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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

    try {
      await createMedication(formData);
      setSaved(true);
      setName("");
      setDosage("");
      setSchedule("");
      setEndDate("");
      setActive(true);
      setNotes("");
      setOpen(false);
      setTimeout(() => setSaved(false), 3000);
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => { setSaved(false); setError(""); setOpen(true); }}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Добавить препарат
        </button>
        {saved && <span className="text-sm text-teal-600">Сохранено</span>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Новый препарат</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Отмена
        </button>
      </div>

      <div>
        <label className={labelClass}>Название *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Метформин"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Дозировка</label>
          <input
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="500 мг"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Расписание / Как принимать</label>
          <input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="2 раза в день после еды"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Дата начала</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Дата окончания</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="active" className="text-sm text-gray-700">
          Активный препарат
        </label>
      </div>

      <div>
        <label className={labelClass}>Заметка</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Принимать строго с едой, не сочетать с алкоголем..."
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить препарат"}
        </button>
        {saved && <span className="text-sm text-teal-600">Сохранено</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
