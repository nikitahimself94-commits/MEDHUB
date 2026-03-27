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
        className="text-sm text-accent hover:brightness-90 disabled:opacity-50"
      >
        {parsing ? "Анализ..." : "AI-разбор"}
      </button>
      {error && <p className="mt-1 text-xs" style={{ color: "var(--amber)" }}>{error}</p>}
    </div>
  );
}
