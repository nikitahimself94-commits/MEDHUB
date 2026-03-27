"use client";

import { useState } from "react";

export function ExportButtons({ text, date }: { text: string; date: string }) {
  const [copied, setCopied] = useState(false);

  const header = `Сводка для визита к врачу — ${new Date(date).toLocaleDateString("ru-RU")}\nСгенерировано в MedHUB\n${"—".repeat(40)}\n\n`;
  const fullText = header + text;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = fullText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleDownload() {
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date(date).toISOString().slice(0, 10);
    a.download = `MedHUB-сводка-${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded px-3 py-1.5 text-xs font-medium hover:brightness-110"
        style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        {copied ? "Скопировано!" : "Копировать текст"}
      </button>
      <button
        type="button"
        onClick={handleDownload}
        className="rounded px-3 py-1.5 text-xs font-medium hover:brightness-110"
        style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
      >
        Скачать .txt
      </button>
    </div>
  );
}
