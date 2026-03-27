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
        className="rounded-xl bg-accent px-3 py-1.5 text-sm hover:brightness-90 disabled:opacity-50"
        style={{ color: "var(--bg-primary)" }}
      >
        {saving ? "Сохранение..." : "Принято"}
      </button>
      {error && <span className="text-xs" style={{ color: "var(--amber)" }}>{error}</span>}
    </div>
  );
}
