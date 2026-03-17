import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { AiUsageStatus } from "@/components/ai-usage-status";
import type { DoctorVisitPrep, DoctorShareLink } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
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
      <h2 className="text-2xl font-bold" style={{ color: "#1A2F2B" }}>Врач</h2>
      <p className="mt-1 text-sm" style={{ color: "#5A8F85" }}>
        Подготовьтесь к приёму, посмотрите сводку и передайте врачу всё важное.
      </p>
      <div className="mt-3">
        <AiUsageStatus used={usageCount} />
      </div>

      {/* === Zone 1: Подготовка к визиту === */}
      <div className="mt-5 rounded-2xl card p-5">
        <h3 className="text-sm font-bold" style={{ color: "#1A2F2B" }}>
          Подготовка к визиту
        </h3>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "#5A8F85" }}>
          AI-помощник соберёт ваши данные — дневник, показатели, лекарства — и сформирует
          структурированную сводку для врача. Не нужно вспоминать всё самому.
        </p>
        <div className="mt-3">
          <GenerateButton />
        </div>
      </div>

      {/* === Zone 2: Готовая сводка === */}
      {lastPrep ? (
        <div className="mt-4 rounded-2xl card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold" style={{ color: "#1A2F2B" }}>
              Сводка для врача
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "#8AA8A2" }}>
                {new Date(lastPrep.created_at).toLocaleString("ru-RU", {
                  day: "2-digit", month: "2-digit",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
              <ExportButtons text={lastPrep.summary} date={lastPrep.created_at} />
            </div>
          </div>
          <div className="mt-4">
            <PrepContent markdown={lastPrep.summary} />
          </div>
          <div
            className="mt-4 pt-3 border-t"
            style={{ borderColor: "rgba(45,110,106,0.1)" }}
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
              Уточнить, что сказать врачу →
            </Link>
          </div>
        </div>
      ) : (
        <div
          className="mt-4 rounded-2xl px-6 py-8 text-center"
          style={{ backgroundColor: "rgba(45,110,106,0.03)", border: "1px dashed #BFC8C5" }}
        >
          <p className="text-sm font-medium" style={{ color: "#2D5A54" }}>
            Сводка ещё не готова
          </p>
          <p className="mt-1 text-xs" style={{ color: "#8AA8A2" }}>
            Нажмите «Подготовить сводку» выше — AI соберёт ваши данные и сформирует выжимку для приёма
          </p>
        </div>
      )}

      {/* === Zone 3: Передача врачу === */}
      <div className="mt-4 rounded-2xl card p-5">
        <h3 className="text-sm font-bold" style={{ color: "#1A2F2B" }}>
          Передать врачу
        </h3>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "#5A8F85" }}>
          Создайте временную ссылку — врач увидит сводку в режиме чтения,
          без доступа к вашим остальным данным. Ссылка действует ограниченное время.
        </p>
        <div className="mt-3">
          <ShareLinkManager activeLink={activeShareLink} />
        </div>
      </div>
    </div>
  );
}

function formatInline(text: string): React.ReactNode {
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

    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) continue;

    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="mt-5 mb-2 text-lg font-bold text-brand-900">
          {formatInline(trimmed.replace(/^#\s+/, "").replace(/\s*📋|⚠️|📝|💊|📊|❓|🩺/g, "").trim())}
        </h2>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="mt-5 mb-2 text-base font-semibold text-brand-900">
          {formatInline(trimmed.slice(3).replace(/\s*📋|⚠️|📝|💊|📊|❓|🩺/g, "").trim())}
        </h3>
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="mt-4 mb-1 text-sm font-semibold text-brand-800">
          {formatInline(trimmed.slice(4).replace(/\s*📋|⚠️|📝|💊|📊|❓|🩺/g, "").trim())}
        </h4>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={i} className="ml-5 list-disc text-sm text-gray-700">
          {formatInline(trimmed.slice(2))}
        </li>
      );
    } else if (/^\d+[\.\)]\s/.test(trimmed)) {
      elements.push(
        <li key={i} className="ml-5 list-decimal text-sm text-gray-700">
          {formatInline(trimmed.replace(/^\d+[\.\)]\s/, ""))}
        </li>
      );
    } else if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (/^\|[\s\-:]+\|/.test(trimmed) && !trimmed.match(/[a-zA-Zа-яА-Я0-9]/)) continue;
      const cells = trimmed.split("|").filter(Boolean).map(c => c.trim());
      elements.push(
        <div key={i} className="flex gap-3 border-b border-gray-100 py-1 text-sm overflow-x-auto">
          {cells.map((cell, ci) => (
            <span key={ci} className={ci === 0 ? "font-medium text-gray-800 shrink-0 min-w-[100px] sm:min-w-[140px]" : "text-gray-600"}>
              {formatInline(cell)}
            </span>
          ))}
        </div>
      );
    } else if (trimmed === "") {
      elements.push(<div key={i} className="h-2" />);
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
