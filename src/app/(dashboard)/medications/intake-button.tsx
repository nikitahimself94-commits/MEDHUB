"use client";

import { useState } from "react";
import { recordIntake } from "./actions";

export function IntakeButton({
  medicationId,
}: {
  medicationId: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setSaving(true);
    setError("");
    try {
      await recordIntake(medicationId);
    } catch {
      setError("Не удалось записать");
      setSaving(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        className="rounded-xl bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {saving ? "Сохранение..." : "Принято"}
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
