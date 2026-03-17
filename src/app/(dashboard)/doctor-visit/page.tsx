import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { ModuleHelp } from "@/components/module-help";
import { AiUsageStatus } from "@/components/ai-usage-status";
import type { DoctorVisitPrep } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DoctorShareLink } from "@/types/database";
import { GenerateButton } from "./generate-button";
import { ExportButtons } from "./export-buttons";
import { ShareLinkManager } from "./share-link-manager";

export default async function DoctorVisitPage() {
  const { patientId, supabase } = await getSessionPatient();

  const { data } = await supabase
    .from("doctor_visit_preps")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1);

  const lastPrep: DoctorVisitPrep | null = (data?.[0] as DoctorVisitPrep) ?? null;
  const usageCount = await getAiUsageCount(supabase as unknown as SupabaseClient, patientId);

  const { data: linkData } = await supabase
    .from("doctor_share_links")
    .select("token, expires_at")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  const activeShareLink = (linkData?.[0] as Pick<DoctorShareLink, "token" | "expires_at">) ?? null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Подготовка к визиту</h2>
      <div className="mt-3">
        <AiUsageStatus used={usageCount} />
      </div>
      <div className="mt-3">
        <ModuleHelp
          title="Сводка для приёма у врача"
          description="AI-ассистент анализирует ваши данные и формирует структурированную сводку: состояние, лекарства, показатели и список вопросов."
          benefit="Помогает не забыть важное на приёме и провести время с врачом максимально эффективно."
        />
      </div>

      <div className="mt-6 flex gap-4">
        <GenerateButton />
      </div>

      <div className="mt-4">
        <ShareLinkManager activeLink={activeShareLink} />
      </div>

      {lastPrep && (
        <div className="mt-6">
          <div className="rounded-xl card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Последняя сводка
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(lastPrep.created_at).toLocaleString("ru-RU")}
                </p>
              </div>
              <ExportButtons text={lastPrep.summary} date={lastPrep.created_at} />
            </div>
            <div className="prose prose-sm mt-4 max-w-none text-gray-800">
              <PrepContent markdown={lastPrep.summary} />
            </div>
          </div>
        </div>
      )}

      {!lastPrep && (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-gray-600">Сводок пока нет</p>
          <p className="mt-1 text-xs text-gray-400">
            Нажмите «Подготовить сводку», чтобы AI собрал информацию для визита к врачу
          </p>
        </div>
      )}
    </div>
  );
}

function formatInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/\*\*(.*?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  );
}

function PrepContent({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip horizontal rules
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) continue;

    // H1
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="mt-5 mb-2 text-lg font-bold text-brand-900">
          {formatInline(trimmed.replace(/^#\s+/, "").replace(/\s*📋|⚠️|📝|💊|📊|❓|🩺/g, "").trim())}
        </h2>
      );
    // H2
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="mt-5 mb-2 text-base font-semibold text-brand-900">
          {formatInline(trimmed.slice(3).replace(/\s*📋|⚠️|📝|💊|📊|❓|🩺/g, "").trim())}
        </h3>
      );
    // H3
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="mt-4 mb-1 text-sm font-semibold text-brand-800">
          {formatInline(trimmed.slice(4).replace(/\s*📋|⚠️|📝|💊|📊|❓|🩺/g, "").trim())}
        </h4>
      );
    // Unordered list
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-5 list-disc text-sm text-gray-700">
          {formatInline(trimmed.slice(2))}
        </li>
      );
    // Numbered list
    } else if (/^\d+[\.\)]\s/.test(trimmed)) {
      elements.push(
        <li key={i} className="ml-5 list-decimal text-sm text-gray-700">
          {formatInline(trimmed.replace(/^\d+[\.\)]\s/, ""))}
        </li>
      );
    // Table rows
    } else if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Skip separator rows like |---|---|
      if (/^\|[\s\-:]+\|/.test(trimmed) && !trimmed.match(/[a-zA-Zа-яА-Я0-9]/)) continue;
      const cells = trimmed.split("|").filter(Boolean).map(c => c.trim());
      elements.push(
        <div key={i} className="flex gap-4 border-b border-gray-100 py-1 text-sm">
          {cells.map((cell, ci) => (
            <span key={ci} className={ci === 0 ? "font-medium text-gray-800 min-w-[140px]" : "text-gray-600"}>
              {formatInline(cell)}
            </span>
          ))}
        </div>
      );
    // Empty line
    } else if (trimmed === "") {
      elements.push(<div key={i} className="h-2" />);
    // Regular paragraph
    } else {
      elements.push(
        <p key={i} className="text-sm text-gray-700 leading-relaxed">
          {formatInline(trimmed)}
        </p>
      );
    }
  }

  return <>{elements}</>;
}
