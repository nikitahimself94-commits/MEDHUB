import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { AiUsageStatus } from "@/components/ai-usage-status";
import type { AiChatMessage } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChatContext } from "./chat-context";
import { ChatUI } from "./chat-ui";

export default async function AiChatPage() {
  const { patientId, supabase } = await getSessionPatient();

  const [
    { data },
    { count: diaryCount },
    { count: vitalsCount },
    { count: medsCount },
    { count: docsCount },
    { data: medProfile },
  ] = await Promise.all([
    supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true })
      .limit(50),
    supabase
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId),
    supabase
      .from("vitals")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId),
    supabase
      .from("medications")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("active", true),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId),
    supabase
      .from("medical_profile")
      .select("id")
      .eq("patient_id", patientId)
      .maybeSingle(),
  ]);

  const messages: AiChatMessage[] = data ?? [];
  const usageCount = await getAiUsageCount(supabase as unknown as SupabaseClient, patientId);

  const layers = [
    { label: "Медкарта", available: !!medProfile },
    { label: "Дневник", available: (diaryCount ?? 0) > 0 },
    { label: "Показатели", available: (vitalsCount ?? 0) > 0 },
    { label: "Лекарства", available: (medsCount ?? 0) > 0 },
    { label: "Документы", available: (docsCount ?? 0) > 0 },
  ];

  return (
    <div>
      <ChatContext layers={layers} />

      <div className="mt-3">
        <AiUsageStatus used={usageCount} />
      </div>

      <div className="mt-4">
        <ChatUI initialMessages={messages} layers={layers} />
      </div>
    </div>
  );
}
