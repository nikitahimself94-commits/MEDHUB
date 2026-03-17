import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { ModuleHelp } from "@/components/module-help";
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

  // Unique non-empty categories for filter dropdown
  const categories = Array.from(new Set(documents.map((d) => d.category).filter(Boolean))).sort();

  const usageCount = await getAiUsageCount(supabase as unknown as SupabaseClient, patientId);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Документы</h2>
      <div className="mt-3">
        <AiUsageStatus used={usageCount} />
      </div>
      <div className="mt-3">
        <ModuleHelp
          title="Ваши медицинские документы — в одном месте"
          description="Сохраняйте результаты анализов, выписки и заключения. Данные видны только вам и тем, кому вы сами дадите доступ."
          benefit="Когда всё под рукой — проще следить за здоровьем, готовиться к визиту и ничего не терять."
        />
      </div>

      <div className="mt-6">
        <DocumentForm />
      </div>

      <div className="mt-8">
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
