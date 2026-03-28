"use client";

import { useState } from "react";
import { generateSecondOpinion } from "./actions";

interface Props {
  documentId: string;
  hasExisting?: boolean;
}

export function SecondOpinionButton({ documentId, hasExisting }: Props) {
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
        className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all ${
          loading ? "animate-pulse" : "hover:brightness-110 active:scale-[0.97]"
        }`}
        style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          color: "var(--text-muted)",
          border: "1px solid rgba(255,255,255,0.10)",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Анализирую..." : hasExisting ? "Обновить мнение" : "Второе мнение"}
      </button>
      {error && <p className="mt-1.5 text-xs" style={{ color: "var(--amber)" }}>{error}</p>}
    </div>
  );
}
