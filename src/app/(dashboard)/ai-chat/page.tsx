import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { ModuleHelp } from "@/components/module-help";
import { AiUsageStatus } from "@/components/ai-usage-status";
import type { AiChatMessage } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChatUI } from "./chat-ui";

export default async function AiChatPage() {
  const { patientId, supabase } = await getSessionPatient();

  const { data } = await supabase
    .from("ai_chat_messages")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true })
    .limit(50);

  const messages: AiChatMessage[] = data ?? [];
  const usageCount = await getAiUsageCount(supabase as unknown as SupabaseClient, patientId);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">AI-ассистент</h2>
      <div className="mt-3">
        <AiUsageStatus used={usageCount} />
      </div>
      <div className="mt-3">
        <ModuleHelp
          title="Умный медицинский помощник"
          description="Задавайте вопросы о здоровье — ассистент видит ваш профиль, показатели, дневник и лекарства."
          benefit="Помогает разобраться в своих данных, напоминает о важном и подсказывает, когда стоит обратиться к врачу."
        />
      </div>

      <div className="mt-6">
        <ChatUI initialMessages={messages} />
      </div>
    </div>
  );
}
