"use client";

import { useState, useMemo } from "react";
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

  return (
    <div>
      <div className="flex gap-3">
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

      <div className="mt-4 space-y-3">
        {documents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
            <p className="text-sm font-medium text-gray-600">Документов пока нет</p>
            <p className="mt-1 text-xs text-gray-400">
              Нажмите «+ Добавить документ», чтобы загрузить первый результат анализа, заключение или снимок
            </p>
          </div>
        )}

        {documents.length > 0 && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center">
            <p className="text-sm font-medium text-gray-600">Ничего не найдено</p>
            <p className="mt-1 text-xs text-gray-400">
              Попробуйте изменить запрос или сбросить фильтр категории
            </p>
          </div>
        )}

        {filtered.map((doc) => {
          const st = STATUS_LABELS[doc.status] ?? STATUS_LABELS.normal;
          return (
            <div key={doc.id} className="rounded-xl card p-4">
              <div className="flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-gray-900">{doc.title}</span>
                  {doc.category && (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                      {doc.category}
                    </span>
                  )}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs ${st.className}`}>
                    {st.text}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(doc.document_date).toLocaleDateString("ru-RU")}
                </span>
              </div>

              {(doc.doctor || doc.lab) && (
                <div className="mt-1 text-sm text-gray-500">
                  {[doc.doctor, doc.lab].filter(Boolean).join(" · ")}
                </div>
              )}

              {doc.notes && (
                <p className="mt-2 text-sm text-gray-700">{doc.notes}</p>
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

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2">
                <div className="flex items-center gap-4">
                  {doc.file_url && (
                    <FileLink storagePath={doc.file_url} fileName={doc.file_name} />
                  )}
                  {doc.file_url && (
                    <span className="text-gray-300">·</span>
                  )}
                  {doc.file_url && (
                    <ParseDocumentButton documentId={doc.id} />
                  )}
                  <SecondOpinionButton documentId={doc.id} />
                </div>
                <DeleteDocumentButton id={doc.id} />
              </div>

              {parseMap[doc.id] && (
                <ParseResult parse={parseMap[doc.id]} />
              )}

              {opinionMap[doc.id] && (
                <OpinionResult opinion={opinionMap[doc.id]} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
