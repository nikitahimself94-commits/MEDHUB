"use client";

import { useState } from "react";
import { createDiaryEntry } from "./actions";
import { diaryPostSaveReaction, type DiaryReaction } from "./diary-reaction";

export function DiaryEntryForm({ entryCount }: { entryCount: number }) {
  const [open, setOpen] = useState(false);
  const [wellbeing, setWellbeing] = useState(5);
  const [symptoms, setSymptoms] = useState("");
  const [painLocation, setPainLocation] = useState("");
  const [painScore, setPainScore] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [sleepQuality, setSleepQuality] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reaction, setReaction] = useState<DiaryReaction | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    const formData = new FormData();
    formData.set("wellbeing_score", String(wellbeing));
    formData.set("symptoms", symptoms);
    formData.set("pain_location", painLocation);
    formData.set("pain_score", painScore);
    formData.set("sleep_hours", sleepHours);
    formData.set("sleep_quality", sleepQuality);
    formData.set("notes", notes);
    formData.set("tags", tags);

    try {
      await createDiaryEntry(formData);

      // Compute agent reaction from just-submitted data before resetting form
      const r = diaryPostSaveReaction({
        wellbeing,
        hasSymptoms: symptoms.trim().length > 0,
        hasPain: painScore !== "" && Number(painScore) > 0,
        hasSleep: sleepHours.trim().length > 0,
        hasNotes: notes.trim().length > 0,
        isFirstEntry: entryCount === 0,
      });
      setReaction(r);

      setSaved(true);
      setWellbeing(5);
      setSymptoms("");
      setPainLocation("");
      setPainScore("");
      setSleepHours("");
      setSleepQuality("");
      setNotes("");
      setTags("");
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
            + Добавить запись
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
        <h3 className="text-lg font-semibold text-gray-800">Новая запись</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Отмена
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {/* Самочувствие */}
        <div>
          <label className={labelClass}>
            Самочувствие: {wellbeing}/10
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={wellbeing}
            onChange={(e) => setWellbeing(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Боль */}
        <div>
          <label className={labelClass}>
            Боль: {painScore || "—"}/10
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={painScore || 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              setPainScore(v === 0 ? "" : String(v));
            }}
            className="w-full"
          />
        </div>
      </div>

      {/* Локализация боли */}
      {painScore && (
        <div>
          <label className={labelClass}>Локализация боли</label>
          <input
            value={painLocation}
            onChange={(e) => setPainLocation(e.target.value)}
            placeholder="Голова, спина, живот..."
            className={inputClass}
          />
        </div>
      )}

      {/* Симптомы */}
      <div>
        <label className={labelClass}>Симптомы (через запятую)</label>
        <input
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Головная боль, тошнота, усталость"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {/* Сон */}
        <div>
          <label className={labelClass}>Часы сна</label>
          <input
            type="text"
            inputMode="decimal"
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)}
            placeholder="7.5 или 6-7"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-gray-400">Число или диапазон, например: 7, 6.5, 6-7</p>
        </div>

        <div>
          <label className={labelClass}>Качество сна: {sleepQuality || "—"}/5</label>
          <input
            type="range"
            min={0}
            max={5}
            value={sleepQuality || 0}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSleepQuality(v === 0 ? "" : String(v));
            }}
            className="w-full"
          />
        </div>
      </div>

      {/* Заметка */}
      <div>
        <label className={labelClass}>Заметка</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Свободный текст..."
          className={inputClass}
        />
      </div>

      {/* Теги */}
      <div>
        <label className={labelClass}>Теги (через запятую)</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="химиотерапия, день 3, после процедуры"
          className={inputClass}
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить запись"}
        </button>
        {saved && reaction && (
          <span className="text-sm" style={{ color: "#2D6E6A" }}>{reaction.line}</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
