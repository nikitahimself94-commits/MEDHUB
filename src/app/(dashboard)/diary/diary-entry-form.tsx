"use client";

import { useState } from "react";
import { createDiaryEntry } from "./actions";
import { diaryPostSaveReaction, type DiaryReaction } from "./diary-reaction";
import { StructuredSymptomInput, type SymptomEntry } from "./structured-symptom-input";
import { ExposureInput, type ExposureEntry } from "./exposure-input";

const labelStyle = { color: "var(--text-muted)" };
const inputStyle = { backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" };

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
  const [structuredSymptoms, setStructuredSymptoms] = useState<SymptomEntry[]>([]);
  const [exposures, setExposures] = useState<ExposureEntry[]>([]);
  const [lifestyle, setLifestyle] = useState({
    activity_text: "", caffeine_text: "", nicotine_text: "", alcohol_text: "",
    food_patterns: "", work_schedule: "", cycle_context: "",
  });
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
    formData.set("structured_symptoms", JSON.stringify(structuredSymptoms));
    formData.set("lifestyle_context", JSON.stringify(lifestyle));
    formData.set("exposures", JSON.stringify(exposures));

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
      setStructuredSymptoms([]);
      setExposures([]);
      setLifestyle({ activity_text: "", caffeine_text: "", nicotine_text: "", alcohol_text: "", food_patterns: "", work_schedule: "", cycle_context: "" });
      setOpen(false);
      setTimeout(() => { setSaved(false); setReaction(null); }, 5000);
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
      <div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setSaved(false); setReaction(null); setError(""); setOpen(true); }}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-gray-900 hover:brightness-90"
          >
            + Добавить запись
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
        <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Новая запись</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm" style={{ color: "var(--text-muted)" }}
        >
          Отмена
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {/* Самочувствие */}
        <div>
          <label className={labelClass} style={labelStyle}>
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
          <label className={labelClass} style={labelStyle}>
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
          <label className={labelClass} style={labelStyle}>Локализация боли</label>
          <input
            value={painLocation}
            onChange={(e) => setPainLocation(e.target.value)}
            placeholder="Голова, спина, живот..."
            className={inputClass}
            style={inputStyle}
          />
        </div>
      )}

      {/* Симптомы */}
      <div>
        <label className={labelClass} style={labelStyle}>Симптомы (через запятую)</label>
        <input
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          placeholder="Головная боль, тошнота, усталость"
          className={inputClass}
          style={inputStyle}
        />
        {/* MCO cue — no symptoms yet */}
        {!symptoms.trim() && structuredSymptoms.length === 0 && (
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.45 }}>
            Если сегодня что-то беспокоило — запиши. Даже один симптом помогает агенту.
          </p>
        )}
        {/* MCO cue — has basic symptom, suggest detail */}
        {(symptoms.trim() || structuredSymptoms.length > 0) && structuredSymptoms.length === 0 && (
          <p className="mt-1 text-[10px]" style={{ color: "var(--accent)", opacity: 0.45 }}>
            Хочешь усилить? Добавь детальный симптом ниже — с триггером, длительностью или интенсивностью.
          </p>
        )}
      </div>

      {/* Structured symptoms */}
      <div>
        <label className={labelClass} style={labelStyle}>Детальные симптомы</label>
        <StructuredSymptomInput value={structuredSymptoms} onChange={setStructuredSymptoms} />
      </div>

      {/* Exposures / Triggers */}
      <div>
        <label className={labelClass} style={labelStyle}>Триггеры / факторы</label>
        <ExposureInput value={exposures} onChange={setExposures} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {/* Сон */}
        <div>
          <label className={labelClass} style={labelStyle}>Часы сна</label>
          <input
            type="text"
            inputMode="decimal"
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)}
            placeholder="7.5 или 6-7"
            className={inputClass}
            style={inputStyle}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Число или диапазон, например: 7, 6.5, 6-7</p>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>Качество сна: {sleepQuality || "—"}/5</label>
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
        <label className={labelClass} style={labelStyle}>Заметка</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Свободный текст..."
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* Теги */}
      <div>
        <label className={labelClass} style={labelStyle}>Теги (через запятую)</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="химиотерапия, день 3, после процедуры"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* Lifestyle / Context */}
      <details className="rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <summary className="px-4 py-2.5 text-sm font-medium cursor-pointer" style={{ color: "var(--text-muted)" }}>
          Контекст / образ жизни
        </summary>
        <div className="px-4 pb-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Физическая активность</label>
              <input value={lifestyle.activity_text} onChange={(e) => setLifestyle({ ...lifestyle, activity_text: e.target.value })} placeholder="Прогулка 30 мин" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Кофеин</label>
              <input value={lifestyle.caffeine_text} onChange={(e) => setLifestyle({ ...lifestyle, caffeine_text: e.target.value })} placeholder="2 чашки кофе" className={inputClass} style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Никотин</label>
              <input value={lifestyle.nicotine_text} onChange={(e) => setLifestyle({ ...lifestyle, nicotine_text: e.target.value })} placeholder="Не курю" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Алкоголь</label>
              <input value={lifestyle.alcohol_text} onChange={(e) => setLifestyle({ ...lifestyle, alcohol_text: e.target.value })} placeholder="Не употребляю" className={inputClass} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Питание</label>
            <input value={lifestyle.food_patterns} onChange={(e) => setLifestyle({ ...lifestyle, food_patterns: e.target.value })} placeholder="3 приёма пищи, без фастфуда" className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Рабочий график</label>
            <input value={lifestyle.work_schedule} onChange={(e) => setLifestyle({ ...lifestyle, work_schedule: e.target.value })} placeholder="Удалёнка, 8ч" className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Цикл / гормональный контекст</label>
            <input value={lifestyle.cycle_context} onChange={(e) => setLifestyle({ ...lifestyle, cycle_context: e.target.value })} placeholder="День 14 цикла" className={inputClass} style={inputStyle} />
          </div>
        </div>
      </details>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-gray-900 hover:brightness-90 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить запись"}
        </button>
        {saved && reaction && (
          <span className="text-sm" style={{ color: "var(--accent)" }}>{reaction.line}</span>
        )}
        {error && <span className="text-sm" style={{ color: "var(--amber)" }}>{error}</span>}
      </div>
    </form>
  );
}
