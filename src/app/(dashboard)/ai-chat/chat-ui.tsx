"use client";

import { useState, useRef, useEffect } from "react";
import { sendMessage } from "./actions";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface LayerInfo {
  label: string;
  available: boolean;
}

const EVIDENCE_HINTS: { key: string; hint: string }[] = [
  { key: "Документы", hint: "Вопросы про анализы и заключения точнее с загруженными документами" },
  { key: "Дневник", hint: "Вопросы про динамику состояния точнее с записями в дневнике" },
  { key: "Показатели", hint: "Вопросы про давление, пульс, вес точнее с записанными показателями" },
  { key: "Лекарства", hint: "Вопросы про препараты точнее с заполненным списком лекарств" },
];

function getEvidenceHint(layers: LayerInfo[]): string | null {
  const missing = EVIDENCE_HINTS.filter(
    (h) => !layers.find((l) => l.label === h.key)?.available
  );
  if (missing.length === 0 || missing.length === EVIDENCE_HINTS.length) return null;
  return missing[0].hint;
}

export function ChatUI({ initialMessages, layers = [] }: { initialMessages: Message[]; layers?: LayerInfo[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput("");
    setSending(true);
    setError("");

    const userMsg: Message = {
      id: "temp-user-" + Date.now(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const reply = await sendMessage(text);
      const assistantMsg: Message = {
        id: "temp-assistant-" + Date.now(),
        role: "assistant",
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 180px)", minHeight: "300px" }}>
      <div className="flex-1 overflow-y-auto rounded-xl card p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-4">
            <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Я уже вижу ваши данные и готов разбираться
            </p>
            <p className="mt-1.5 text-sm text-center max-w-sm" style={{ color: "var(--text-muted)" }}>
              Спросите о состоянии, динамике, лекарствах — или выберите один из вопросов ниже
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 max-w-md">
              {[
                "Как меняется моё состояние за последние дни?",
                "Есть ли тревожные сигналы в моих показателях?",
                "Что стоит обсудить с врачом на приёме?",
                "Подведи итог по моим документам",
                "Какие лекарства я принимаю и зачем?",
                "На что обратить внимание в ближайшее время?",
              ].map((q, idx) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => { setInput(q); }}
                  className={`rounded-full px-3.5 py-2 text-xs font-medium transition hover:shadow-sm${idx >= 4 ? " hidden sm:inline-flex" : ""}`}
                  style={{
                    backgroundColor: "var(--accent-muted)",
                    color: "var(--accent)",
                    border: "1px solid rgba(45,212,191,0.15)",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-accent"
                    : ""
                }`}
                style={
                  msg.role === "user"
                    ? { color: "var(--bg-primary)" }
                    : { backgroundColor: "var(--bg-surface-hover)", color: "var(--text-primary)" }
                }
              >
                <div className="space-y-2">
                  {msg.content.split(/\n\n+/).map((paragraph, pi) => (
                    <p key={pi} className="whitespace-pre-wrap leading-relaxed">{paragraph.trim()}</p>
                  ))}
                </div>
                <p
                  className="mt-1 text-xs"
                  style={{ color: msg.role === "user" ? "var(--bg-surface)" : "var(--text-muted)" }}
                >
                  {new Date(msg.created_at).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-lg px-4 py-2 text-sm" style={{ backgroundColor: "var(--bg-surface-hover)", color: "var(--text-muted)" }}>
                Думаю...
              </div>
            </div>
          )}
        </div>

        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--amber)" }}>{error}</p>
      )}

      {(() => {
        const hint = getEvidenceHint(layers);
        return hint ? (
          <p className="mt-2 text-[11px] px-1" style={{ color: "var(--text-muted)" }}>{hint}</p>
        ) : null;
      })()}

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Задайте вопрос..."
          disabled={sending}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent-muted focus:border-accent disabled:opacity-50"
          style={{ backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium hover:brightness-90 disabled:opacity-50"
          style={{ color: "var(--bg-primary)" }}
        >
          {sending ? "..." : <><span className="hidden sm:inline">Отправить</span><span className="sm:hidden">&rarr;</span></>}
        </button>
      </form>
    </div>
  );
}
