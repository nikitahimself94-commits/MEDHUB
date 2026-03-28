import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { AiUsageStatus } from "@/components/ai-usage-status";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PlanGenerator } from "./plan-generator";

export default async function AiPlanPage() {
  const { patientId, supabase } = await getSessionPatient();
  const used = await getAiUsageCount(supabase as unknown as SupabaseClient, patientId);

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>AI-план</h2>
      <p className="mt-2 text-[14px]" style={{ color: "var(--text-muted)" }}>
        Персональный план наблюдения за здоровьем на основе ваших данных в MedHUB.
      </p>

      <div className="mt-4">
        <AiUsageStatus used={used} />
      </div>

      <PlanGenerator />
    </div>
  );
}
