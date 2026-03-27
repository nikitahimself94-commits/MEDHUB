"use client";

import { useState } from "react";
import { getSignedFileUrl } from "./actions";

export function FileLink({
  storagePath,
  fileName,
}: {
  storagePath: string;
  fileName: string | null;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const url = await getSignedFileUrl(storagePath);
      window.open(url, "_blank");
    } catch {
      alert("Не удалось открыть файл");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      {fileName && (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fileName}</span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-sm text-accent hover:brightness-90 disabled:opacity-50"
      >
        {loading ? "Загрузка..." : "Открыть"}
      </button>
    </span>
  );
}
