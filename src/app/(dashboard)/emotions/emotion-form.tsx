"use client";

import { useState } from "react";
import { createEmotionEntry } from "./actions";
import { emotionPostSaveReaction, type EmotionReaction } from "./emotions-companion";

const PARAMS = [
  { key: "anxiety", label: "Тревога" },
  { key: "depression", label: "Подавленность" },
  { key: "calmness", label: "Спокойствие" },
  { key: "fatigue", label: "Усталость" },
  { key: "hope", label: "Надежда" },
] as const;

type Scores = Record<string, number>;

const labelStyle = { color: "var(--text-muted)" };
const inputStyle = { backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" };

export function EmotionForm({ entryCount }: { entryCount: number }) {
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState<Scores>(() =>
    Object.fromEntries(PARAMS.map((p) => [p.key, 3]))
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reaction, setReaction] = useState<EmotionReaction | null>(null);
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

      const r = emotionPostSaveReaction({
        scores: {
          anxiety: scores.anxiety,
          depression: scores.depression,
          calmness: scores.calmness,
          fatigue: scores.fatigue,
          hope: scores.hope,
        },
        hasNotes: notes.trim().length > 0,
        isFirstEntry: entryCount === 0,
      });
      setReaction(r);

      setSaved(true);
      setScores(Object.fromEntries(PARAMS.map((p) => [p.key, 3])));
      setNotes("");
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
            + Записать эмоции
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
        <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Запись эмоций</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm" style={{ color: "var(--text-muted)" }}
        >
          Отмена
        </button>
      </div>

      {PARAMS.map((p) => (
        <div key={p.key}>
          <label className={labelClass} style={labelStyle}>
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
                    ? "bg-accent text-gray-900"
                    : "hover:brightness-110"
                }`}
                style={
                  scores[p.key] === n
                    ? undefined
                    : { backgroundColor: "var(--bg-surface-hover)", color: "var(--text-muted)" }
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div>
        <label className={labelClass} style={labelStyle}>Заметка</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Что повлияло на настроение..."
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
        {saved && reaction && (
          <span className="text-sm" style={{ color: "var(--accent)" }}>{reaction.line}</span>
        )}
        {error && <span className="text-sm" style={{ color: "var(--amber)" }}>{error}</span>}
      </div>
    </form>
  );
}
