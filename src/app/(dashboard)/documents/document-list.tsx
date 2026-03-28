"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Document, DocumentParse, DocumentOpinion } from "@/types/database";
import { FileLink } from "./file-link";
import { DeleteDocumentButton } from "./delete-document-button";
import { ParseDocumentButton } from "./parse-document-button";
import { ParseResult } from "./parse-result";
import { SecondOpinionButton } from "./second-opinion-button";
import { OpinionResult } from "./opinion-result";

const STATUS_LABELS: Record<string, { text: string; style: React.CSSProperties }> = {
  normal: { text: "Норма", style: { backgroundColor: "var(--accent-muted)", color: "var(--accent)" } },
  review: { text: "Внимание", style: { backgroundColor: "rgba(245,158,11,0.1)", color: "var(--amber)" } },
  abnormal: { text: "Отклонение", style: { backgroundColor: "rgba(245,158,11,0.1)", color: "var(--amber)" } },
};

interface Props {
  documents: Document[];
  parseMap: Record<string, DocumentParse>;
  opinionMap: Record<string, DocumentOpinion>;
  categories: string[];
}

export function DocumentList({ documents, parseMap, opinionMap, categories }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return documents.filter((doc) => {
      if (category && doc.category !== category) return false;
      if (q && !doc.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, search, category]);

  if (documents.length === 0) {
    return (
      <div
        className="rounded-2xl px-6 py-8 text-center"
        style={{ backgroundColor: "var(--accent-muted)", border: "1px dashed var(--border)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Загрузите первый документ — и AI начнёт работать
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Подойдёт любой анализ, выписка или заключение. Даже старый — это уже ценный контекст.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Search / filter */}
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию..."
          className="flex-1 rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent-muted focus:border-accent"
          style={{ backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent-muted focus:border-accent"
          style={{ backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-4">
        {filtered.length === 0 && (
          <div className="rounded-2xl px-6 py-8 text-center" style={{ border: "1px dashed var(--border)", backgroundColor: "var(--bg-surface)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Ничего не найдено</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Попробуйте изменить запрос или сбросить фильтр категории
            </p>
          </div>
        )}

        {filtered.map((doc) => {
          const st = STATUS_LABELS[doc.status] ?? STATUS_LABELS.normal;
          const hasParse = !!parseMap[doc.id];
          const hasOpinion = !!opinionMap[doc.id];
          const hasAiResults = hasParse || hasOpinion;

          return (
            <div key={doc.id} className="rounded-xl card overflow-hidden">
              {/* Document header */}
              <div className="p-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium truncate max-w-full" style={{ color: "var(--text-primary)" }}>{doc.title}</span>
                  <span className="shrink-0 ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(doc.document_date).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {doc.category && (
                    <span className="rounded-full px-2.5 py-0.5 text-xs" style={{ backgroundColor: "var(--bg-surface-hover)", color: "var(--text-muted)" }}>
                      {doc.category}
                    </span>
                  )}
                  <span className="rounded-full px-2.5 py-0.5 text-xs" style={st.style}>
                    {st.text}
                  </span>
                </div>

                {(doc.doctor || doc.lab) && (
                  <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                    {[doc.doctor, doc.lab].filter(Boolean).join(" · ")}
                  </p>
                )}

                {doc.notes && (
                  <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{doc.notes}</p>
                )}

                {doc.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {doc.tags.map((t, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-accent-muted px-2.5 py-0.5 text-xs text-accent"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* AI actions — primary controls */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {doc.file_url && !hasParse && (
                    <ParseDocumentButton documentId={doc.id} />
                  )}
                  {!doc.file_url && !hasParse && (
                    <p className="text-[12px]" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                      Загрузите файл — AI сможет разобрать документ
                    </p>
                  )}
                  {hasParse && (
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                      style={{ backgroundColor: "rgba(45,212,191,0.08)", color: "var(--accent)" }}
                    >
                      Разобран
                    </span>
                  )}
                  <SecondOpinionButton documentId={doc.id} hasExisting={hasOpinion} />
                </div>

                {/* Secondary actions */}
                <div className="mt-2 flex items-center gap-3 text-xs">
                  {doc.file_url && (
                    <FileLink storagePath={doc.file_url} fileName={doc.file_name} />
                  )}
                  <DeleteDocumentButton id={doc.id} />
                </div>
              </div>

              {/* AI results — main value zone */}
              {hasAiResults && (
                <div className="px-4 pb-4 space-y-3">
                  {parseMap[doc.id] && (
                    <ParseResult parse={parseMap[doc.id]} />
                  )}
                  {opinionMap[doc.id] && (
                    <OpinionResult opinion={opinionMap[doc.id]} />
                  )}
                  <Link
                    href="/ai-chat"
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition hover:brightness-110"
                    style={{
                      backgroundColor: "rgba(45,212,191,0.08)",
                      color: "var(--accent)",
                      border: "1px solid rgba(45,212,191,0.15)",
                    }}
                  >
                    Обсудить с AI-помощником →
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
