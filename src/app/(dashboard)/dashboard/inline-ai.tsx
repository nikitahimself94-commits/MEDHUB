"use client";

import { useState } from "react";
import Link from "next/link";
import { sendMessage } from "../ai-chat/actions";

const EXAMPLE_QUESTIONS = [
  "Как у меня дела по данным?",
  "Что обсудить с врачом?",
  "Объясни мой последний анализ",
];

export function InlineAi() {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [answer, setAnswer] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setQuestion(text);
    setInput("");
    setSending(true);
    setError("");
    setAnswer("");

    try {
      const reply = await sendMessage(text);
      setAnswer(reply);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось получить ответ");
    } finally {
      setSending(false);
    }
  }

  function handleExample(q: string) {
    setInput(q);
  }

  return (
    <div className="rounded-2xl card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Спросите AI-помощника
        </h3>
        <Link href="/ai-chat" className="text-xs font-medium" style={{ color: "var(--accent)" }}>
          Полный чат →
        </Link>
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        Я вижу ваши данные и помогу разобраться
      </p>

      {/* Answer display */}
      {(sending || answer || error) && (
        <div className="mt-3 rounded-xl p-3" style={{ backgroundColor: "var(--accent-muted)" }}>
          {question && (
            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              {question}
            </p>
          )}
          {sending && (
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Думаю...
            </p>
          )}
          {answer && (
            <p
              className="mt-2 text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "var(--text-primary)" }}
            >
              {answer.length > 600 ? answer.slice(0, 600) + "..." : answer}
            </p>
          )}
          {answer && answer.length > 600 && (
            <Link
              href="/ai-chat"
              className="mt-1 inline-block text-xs font-medium"
              style={{ color: "var(--accent)" }}
            >
              Читать полностью →
            </Link>
          )}
          {error && (
            <p className="mt-2 text-sm" style={{ color: "var(--amber)" }}>{error}</p>
          )}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Задайте вопрос..."
          disabled={sending}
          className="flex-1 rounded-xl px-3 py-2 text-sm transition-all outline-none disabled:opacity-50"
          style={{
            backgroundColor: "var(--bg-surface-hover)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-50"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--bg-primary)",
          }}
        >
          {sending ? "..." : "→"}
        </button>
      </form>

      {/* Example questions — hidden when there's an answer */}
      {!answer && !sending && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => handleExample(q)}
              className="rounded-full px-2.5 py-1 text-xs transition"
              style={{ backgroundColor: "var(--accent-muted)", color: "var(--accent)" }}
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
