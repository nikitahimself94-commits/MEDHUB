import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiFeatureName } from "@/types/database";

interface LogParams {
  supabase: SupabaseClient;
  patientId: string;
  userId: string;
  feature: AiFeatureName;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Fire-and-forget AI usage logging.
 * Errors are caught silently so usage tracking never breaks the main flow.
 */
export function logAiUsage(params: LogParams): void {
  params.supabase
    .from("ai_usage_events")
    .insert({
      patient_id: params.patientId,
      created_by: params.userId,
      feature_name: params.feature,
      model: params.model,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
    })
    .then(({ error }) => {
      if (error) console.error("[ai-usage] failed to log:", error.message);
    });
}
