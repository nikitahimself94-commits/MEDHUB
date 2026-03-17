import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { AiUsageStatus } from "@/components/ai-usage-status";
import type { Document, DocumentParse, DocumentOpinion } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentForm } from "./document-form";
import { DocumentList } from "./document-list";

export default async function DocumentsPage() {
  const { patientId, supabase } = await getSessionPatient();

  const [{ data: docs }, { data: parses }, { data: opinions }] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("document_parses")
      .select("*")
      .eq("patient_id", patientId),
    supabase
      .from("document_opinions")
      .select("*")
      .eq("patient_id", patientId),
  ]);

  const documents: Document[] = docs ?? [];

  const parseMap: Record<string, DocumentParse> = {};
  for (const p of (parses ?? []) as DocumentParse[]) {
    parseMap[p.document_id] = p;
  }

  const opinionMap: Record<string, DocumentOpinion> = {};
  for (const o of (opinions ?? []) as DocumentOpinion[]) {
    opinionMap[o.document_id] = o;
  }

  const categories = Array.from(new Set(documents.map((d) => d.category).filter(Boolean))).sort();
  const usageCount = await getAiUsageCount(supabase as unknown as SupabaseClient, patientId);
  const isEmpty = documents.length === 0;

  // Stats for non-empty state
  const parsedCount = documents.filter((d) => parseMap[d.id]).length;
  const opinionCount = documents.filter((d) => opinionMap[d.id]).length;

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "#1A2F2B" }}>Документы</h2>
      <p className="mt-1 text-sm" style={{ color: "#5A8F85" }}>
        {isEmpty
          ? "Загрузите один документ — и AI начнёт работать"
          : "Рабочая зона: загружайте, разбирайте, получайте выводы"}
      </p>
      <div className="mt-3">
        <AiUsageStatus used={usageCount} />
      </div>

      {/* Empty state: first-value promise */}
      {isEmpty && (
        <div className="mt-5 rounded-2xl card p-6">
          <p className="text-[15px] font-semibold" style={{ color: "#1A2F2B" }}>
            Начните с одного документа — этого достаточно
          </p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "#5A8F85" }}>
            Старый анализ, выписка, заключение — подойдёт что угодно, даже фото на телефон.
            Не нужно заполнять остальные разделы. Один документ запускает всю цепочку.
          </p>

          {/* Value chain */}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(45,110,106,0.05)" }}>
              <p className="text-xs font-bold" style={{ color: "#2D6E6A" }}>1. Загрузка</p>
              <p className="mt-0.5 text-xs" style={{ color: "#5A8F85" }}>
                Добавьте документ как есть
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(45,110,106,0.05)" }}>
              <p className="text-xs font-bold" style={{ color: "#2D6E6A" }}>2. AI-разбор</p>
              <p className="mt-0.5 text-xs" style={{ color: "#5A8F85" }}>
                Содержание простым языком
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(45,110,106,0.05)" }}>
              <p className="text-xs font-bold" style={{ color: "#2D6E6A" }}>3. Второе мнение</p>
              <p className="mt-0.5 text-xs" style={{ color: "#5A8F85" }}>
                На что обратить внимание
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Non-empty: progress overview */}
      {!isEmpty && (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: "#3D6B62" }}>
          <span>Документов: <strong>{documents.length}</strong></span>
          <span>Разобрано: <strong>{parsedCount}</strong></span>
          <span>Второе мнение: <strong>{opinionCount}</strong></span>
        </div>
      )}

      {/* Upload form */}
      <div className="mt-5">
        <DocumentForm />
      </div>

      {/* Document list */}
      <div className="mt-6">
        <DocumentList
          documents={documents}
          parseMap={parseMap}
          opinionMap={opinionMap}
          categories={categories}
        />
      </div>
    </div>
  );
}
