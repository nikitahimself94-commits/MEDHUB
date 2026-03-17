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

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  normal: { text: "Норма", className: "bg-teal-50 text-teal-700" },
  review: { text: "Внимание", className: "bg-yellow-50 text-yellow-700" },
  abnormal: { text: "Отклонение", className: "bg-red-50 text-red-700" },
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
        style={{ backgroundColor: "rgba(45,110,106,0.03)", border: "1px dashed #BFC8C5" }}
      >
        <p className="text-sm font-medium" style={{ color: "#2D5A54" }}>
          Загрузите первый документ — и AI начнёт работать
        </p>
        <p className="mt-1 text-xs" style={{ color: "#5A8F85" }}>
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
          className="flex-1 rounded-xl border border-gray-200 bg-white/60 px-4 py-2.5 text-sm transition-all focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/10"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white/60 px-4 py-2.5 text-sm text-gray-700 transition-all focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/10"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-4">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center">
            <p className="text-sm font-medium text-gray-600">Ничего не найдено</p>
            <p className="mt-1 text-xs text-gray-400">
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
                  <span className="font-medium truncate max-w-full" style={{ color: "#1A2F2B" }}>{doc.title}</span>
                  <span className="shrink-0 ml-auto text-xs" style={{ color: "#8AA8A2" }}>
                    {new Date(doc.document_date).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {doc.category && (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                      {doc.category}
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs ${st.className}`}>
                    {st.text}
                  </span>
                </div>

                {(doc.doctor || doc.lab) && (
                  <p className="mt-1 text-sm" style={{ color: "#8AA8A2" }}>
                    {[doc.doctor, doc.lab].filter(Boolean).join(" · ")}
                  </p>
                )}

                {doc.notes && (
                  <p className="mt-2 text-sm" style={{ color: "#3D6B62" }}>{doc.notes}</p>
                )}

                {doc.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {doc.tags.map((t, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* AI actions — elevated */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {doc.file_url && !hasParse && (
                    <ParseDocumentButton documentId={doc.id} />
                  )}
                  {hasParse && (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: "rgba(45,110,106,0.08)", color: "#2D6E6A" }}
                    >
                      Разобран
                    </span>
                  )}
                  {!hasOpinion && (
                    <SecondOpinionButton documentId={doc.id} />
                  )}
                  {hasOpinion && (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ backgroundColor: "rgba(100,116,139,0.08)", color: "#475569" }}
                    >
                      Второе мнение получено
                    </span>
                  )}
                </div>

                {/* Secondary actions */}
                <div className="mt-2 flex items-center gap-3 text-xs">
                  {doc.file_url && (
                    <FileLink storagePath={doc.file_url} fileName={doc.file_name} />
                  )}
                  <DeleteDocumentButton id={doc.id} />
                </div>
              </div>

              {/* AI results — full-width blocks below the card body */}
              {hasAiResults && (
                <div className="border-t" style={{ borderColor: "rgba(45,110,106,0.1)" }}>
                  {parseMap[doc.id] && (
                    <div className="p-4">
                      <ParseResult parse={parseMap[doc.id]} />
                    </div>
                  )}
                  {opinionMap[doc.id] && (
                    <div className="p-4 pt-0">
                      <OpinionResult opinion={opinionMap[doc.id]} />
                    </div>
                  )}
                  <div
                    className="px-4 pb-4 pt-1 border-t"
                    style={{ borderColor: "rgba(45,110,106,0.08)" }}
                  >
                    <Link
                      href="/ai-chat"
                      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition hover:shadow-sm"
                      style={{
                        backgroundColor: "rgba(45,110,106,0.06)",
                        color: "#2D6E6A",
                        border: "1px solid rgba(45,110,106,0.12)",
                      }}
                    >
                      Обсудить с AI-помощником →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
