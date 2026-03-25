import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { AiUsageStatus } from "@/components/ai-usage-status";
import type { Document, DocumentParse, DocumentOpinion } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentForm } from "./document-form";
import { DocumentList } from "./document-list";
import { documentsCompanion } from "./documents-companion";

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

  const companion = documentsCompanion({ totalDocs: documents.length, parsedCount, opinionCount });

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "#1A2F2B" }}>Документы</h2>
      <div className="mt-3">
        <AiUsageStatus used={usageCount} />
      </div>

      {/* Agent companion block */}
      <div
        className="mt-4 rounded-2xl px-5 py-4"
        style={{ backgroundColor: "rgba(45,110,106,0.05)" }}
      >
        <p className="text-[14px] font-medium leading-snug" style={{ color: "#1A2F2B" }}>
          {companion.line}
        </p>
        {companion.supporting && (
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "#5A8F85" }}>
            {companion.supporting}
          </p>
        )}
        {!isEmpty && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]" style={{ color: "#8AA8A2" }}>
            <span>Документов: {documents.length}</span>
            <span>Разобрано: {parsedCount}</span>
            <span>Второе мнение: {opinionCount}</span>
          </div>
        )}
      </div>

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
