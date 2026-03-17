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
        className="text-sm text-slate-500 hover:text-slate-700 disabled:opacity-50"
      >
        {loading ? "Анализ..." : "Второе мнение"}
      </button>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
