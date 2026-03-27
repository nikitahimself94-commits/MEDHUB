"use client";

import { useState } from "react";
import { generateSecondOpinion } from "./actions";

export function SecondOpinionButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      await generateSecondOpinion(documentId);
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
        onClick={handleClick}
        disabled={loading}
        className="text-sm disabled:opacity-50"
        style={{ color: "var(--text-muted)" }}
      >
        {loading ? "Анализ..." : "Второе мнение"}
      </button>
      {error && <p className="mt-1 text-xs" style={{ color: "var(--amber)" }}>{error}</p>}
    </div>
  );
}
