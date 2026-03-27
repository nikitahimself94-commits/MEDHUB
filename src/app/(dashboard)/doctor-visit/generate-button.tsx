"use client";

import { useState } from "react";
import { generateVisitPrep } from "./actions";

export function GenerateButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      await generateVisitPrep();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка генерации");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium hover:brightness-90 disabled:opacity-50"
        style={{ color: "var(--bg-primary)" }}
      >
        {loading ? "Генерация..." : "Подготовить сводку"}
      </button>
      {error && <p className="mt-2 text-sm" style={{ color: "var(--amber)" }}>{error}</p>}
    </div>
  );
}
