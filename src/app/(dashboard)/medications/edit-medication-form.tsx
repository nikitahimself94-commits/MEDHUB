"use client";

import { useState, useTransition } from "react";
import { updateMedication } from "./actions";
import type { Medication } from "@/types/database";

export function EditMedicationForm({ med }: { med: Medication }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(med.name);
  const [dosage, setDosage] = useState(med.dosage);
  const [schedule, setSchedule] = useState(med.schedule);
  const [startDate, setStartDate] = useState(med.start_date);
  const [endDate, setEndDate] = useState(med.end_date ?? "");
  const [notes, setNotes] = useState(med.notes ?? "");
  const [error, setError] = useState("");

  function handleOpen() {
    setName(med.name);
    setDosage(med.dosage);
    setSchedule(med.schedule);
    setStartDate(med.start_date);
    setEndDate(med.end_date ?? "");
    setNotes(med.notes ?? "");
    setError("");
    setOpen(true);
  }

  function handleCancel() {
    setOpen(false);
    setError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Название обязательно");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await updateMedication(med.id, {
          name: name.trim(),
          dosage: dosage.trim(),
          schedule: schedule.trim(),
          start_date: startDate,
          end_date: endDate || null,
          notes: notes.trim() || null,
        });
        setOpen(false);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Ошибка сохранения");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs text-gray-400 hover:text-gray-600"
      >
        Редактировать
      </button>
    );
  }

  const labelClass = "block text-xs font-medium text-gray-600 mb-1";
  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white/60 px-3 py-2 text-sm transition-all focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/10";

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-white/40 p-4">
      <div>
        <label className={labelClass}>Название *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Дозировка</label>
          <input value={dosage} onChange={(e) => setDosage(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Расписание</label>
          <input value={schedule} onChange={(e) => setSchedule(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Дата начала</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Дата окончания</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Заметка</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {isPending ? "Сохранение..." : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Отмена
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
