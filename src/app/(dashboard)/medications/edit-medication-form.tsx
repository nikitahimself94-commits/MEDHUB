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
  const [purpose, setPurpose] = useState(med.purpose ?? "");
  const [effect, setEffect] = useState(med.effect ?? "");
  const [sideEffects, setSideEffects] = useState(med.side_effects ?? "");
  const [therapyChanges, setTherapyChanges] = useState(med.therapy_changes ?? "");
  const [error, setError] = useState("");

  function handleOpen() {
    setName(med.name);
    setDosage(med.dosage);
    setSchedule(med.schedule);
    setStartDate(med.start_date);
    setEndDate(med.end_date ?? "");
    setNotes(med.notes ?? "");
    setPurpose(med.purpose ?? "");
    setEffect(med.effect ?? "");
    setSideEffects(med.side_effects ?? "");
    setTherapyChanges(med.therapy_changes ?? "");
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
          purpose: purpose.trim(),
          effect: effect.trim(),
          side_effects: sideEffects.trim(),
          therapy_changes: therapyChanges.trim(),
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
        className="text-xs hover:brightness-110"
        style={{ color: "var(--text-muted)" }}
      >
        Редактировать
      </button>
    );
  }

  const labelClass = "block text-xs font-medium mb-1";
  const labelStyle = { color: "var(--text-muted)" } as const;
  const inputClass =
    "w-full rounded-xl px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent-muted focus:border-accent";
  const inputStyle = { backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" } as const;

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-xl p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
      <div>
        <label className={labelClass} style={labelStyle}>Название *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={inputStyle} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} style={labelStyle}>Дозировка</label>
          <input value={dosage} onChange={(e) => setDosage(e.target.value)} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Расписание</label>
          <input value={schedule} onChange={(e) => setSchedule(e.target.value)} className={inputClass} style={inputStyle} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} style={labelStyle}>Дата начала</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Дата окончания</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} style={inputStyle} />
        </div>
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Заметка</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Назначение</label>
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Для снижения давления" className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Эффект</label>
        <input value={effect} onChange={(e) => setEffect(e.target.value)} className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Побочные эффекты</label>
        <input value={sideEffects} onChange={(e) => setSideEffects(e.target.value)} className={inputClass} style={inputStyle} />
      </div>

      <div>
        <label className={labelClass} style={labelStyle}>Изменения в терапии</label>
        <textarea value={therapyChanges} onChange={(e) => setTherapyChanges(e.target.value)} rows={2} className={inputClass} style={inputStyle} />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium hover:brightness-90 disabled:opacity-50"
          style={{ color: "var(--bg-primary)" }}
        >
          {isPending ? "Сохранение..." : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="text-sm hover:brightness-110"
          style={{ color: "var(--text-muted)" }}
        >
          Отмена
        </button>
        {error && <span className="text-sm" style={{ color: "var(--amber)" }}>{error}</span>}
      </div>
    </form>
  );
}
