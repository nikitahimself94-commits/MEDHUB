"use client";

import { useState } from "react";
import { createEmotionEntry } from "./actions";

const PARAMS = [
  { key: "anxiety", label: "Тревога" },
  { key: "depression", label: "Подавленность" },
  { key: "calmness", label: "Спокойствие" },
  { key: "fatigue", label: "Усталость" },
  { key: "hope", label: "Надежда" },
] as const;

type Scores = Record<string, number>;

export function EmotionForm() {
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState<Scores>(() =>
    Object.fromEntries(PARAMS.map((p) => [p.key, 3]))
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function setScore(key: string, val: number) {
    setScores((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    const formData = new FormData();
    for (const p of PARAMS) {
      formData.set(p.key, String(scores[p.key]));
    }
    formData.set("notes", notes);

    try {
      await createEmotionEntry(formData);
      setSaved(true);
      setScores(Object.fromEntries(PARAMS.map((p) => [p.key, 3])));
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
          + Записать эмоции
        </button>
        {saved && <span className="text-sm text-teal-600">Сохранено</span>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Запись эмоций</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Отмена
        </button>
      </div>

      {PARAMS.map((p) => (
        <div key={p.key}>
          <label className={labelClass}>
            {p.label}: {scores[p.key]}
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setScore(p.key, n)}
                className={`h-9 w-9 rounded-xl text-sm font-medium ${
                  scores[p.key] === n
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div>
        <label className={labelClass}>Заметка</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Что повлияло на настроение..."
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
        {saved && <span className="text-sm text-teal-600">Сохранено</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
