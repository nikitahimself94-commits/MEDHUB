"use client";

import { useState } from "react";
import { parseDocument } from "./actions";

export function ParseDocumentButton({ documentId }: { documentId: string }) {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");

  async function handleParse() {
    setParsing(true);
    setError("");
    try {
      await parseDocument(documentId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка AI-разбора");
    } finally {
      setParsing(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleParse}
        disabled={parsing}
        className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all ${
          parsing ? "animate-pulse" : "hover:brightness-110 active:scale-[0.97]"
        }`}
        style={{
          backgroundColor: "rgba(45,212,191,0.12)",
          color: "var(--accent)",
          border: "1px solid rgba(45,212,191,0.25)",
          opacity: parsing ? 0.7 : 1,
        }}
      >
        {parsing ? "Анализирую..." : "AI-разбор"}
      </button>
      {error && <p className="mt-1.5 text-xs" style={{ color: "var(--amber)" }}>{error}</p>}
    </div>
  );
}
