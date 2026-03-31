"use client";

import Link from "next/link";
import { useState } from "react";
import { DeleteEventButton } from "./delete-event-button";

export interface FeedItem {
  id: string;
  source: "event" | "diary" | "vitals" | "medications" | "documents" | "emotions";
  occurred_at: string;
  title: string;
  subtitle: string | null;
  href: string | null;
  /** Only manual events are deletable */
  deletable?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  event: "Событие",
  diary: "Дневник",
  vitals: "Показатели",
  medications: "Лекарства",
  documents: "Документы",
  emotions: "Эмоции",
};

const SOURCE_COLORS: Record<string, string> = {
  event: "var(--text-muted)",
  diary: "var(--accent)",
  vitals: "rgba(45,212,191,0.7)",
  medications: "rgba(139,92,246,0.7)",
  documents: "rgba(59,130,246,0.7)",
  emotions: "rgba(244,114,182,0.7)",
};

const FILTER_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "event", label: "События" },
  { key: "diary", label: "Дневник" },
  { key: "vitals", label: "Показатели" },
  { key: "medications", label: "Лекарства" },
  { key: "documents", label: "Документы" },
  { key: "emotions", label: "Эмоции" },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

function formatTime(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  if (h === 0 && m === 0) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function UnifiedFeed({ items }: { items: FeedItem[] }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? items : items.filter((i) => i.source === filter);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className="rounded-md px-2.5 py-1 text-[10px] font-medium transition-all"
            style={{
              backgroundColor: filter === opt.key ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.04)",
              color: filter === opt.key ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${filter === opt.key ? "rgba(45,212,191,0.2)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {filtered.length === 0 && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Нет записей</p>
      )}

      <div className="space-y-2">
        {filtered.map((item) => {
          const time = formatTime(item.occurred_at);

          const content = (
            <div
              className={`rounded-lg px-3.5 py-2.5 ${item.href ? "transition-opacity hover:opacity-80" : ""}`}
              style={{
                backgroundColor: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderLeft: `2.5px solid ${SOURCE_COLORS[item.source] ?? "rgba(255,255,255,0.1)"}`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: SOURCE_COLORS[item.source] ?? "var(--text-muted)" }}>
                      {SOURCE_LABELS[item.source] ?? item.source}
                    </span>
                    <span className="text-[9px]" style={{ color: "var(--text-muted)", opacity: 0.4 }}>
                      {formatDate(item.occurred_at)}{time ? ` · ${time}` : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="mt-0.5 text-[10px] truncate" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                      {item.subtitle}
                    </p>
                  )}
                </div>
                {item.deletable && <DeleteEventButton eventId={item.id} />}
              </div>
            </div>
          );

          return item.href ? (
            <Link key={item.id} href={item.href} className="block">
              {content}
            </Link>
          ) : (
            <div key={item.id}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
