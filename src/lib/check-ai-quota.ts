import type { SupabaseClient } from "@supabase/supabase-js";

/** Max AI calls per patient in a rolling 30-day window */
export const AI_MONTHLY_LIMIT = 100;

function thirtyDaysAgo(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Throws a user-friendly error if the patient has exceeded their AI quota.
 * Call this before every Claude API request.
 */
export async function checkAiQuota(
  supabase: SupabaseClient,
  patientId: string
): Promise<void> {
  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .gte("created_at", thirtyDaysAgo());

  if (error) {
    console.error("[ai-quota] check failed:", error.message);
    return;
  }

  if ((count ?? 0) >= AI_MONTHLY_LIMIT) {
    throw new Error(
      `Лимит AI-запросов исчерпан (${AI_MONTHLY_LIMIT} за 30 дней). Попробуйте позже или обратитесь в поддержку.`
    );
  }
}

/**
 * Returns current usage count for the rolling 30-day window.
 * Returns 0 on error so the UI always renders.
 */
export async function getAiUsageCount(
  supabase: SupabaseClient,
  patientId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId)
    .gte("created_at", thirtyDaysAgo());

  if (error) {
    console.error("[ai-quota] usage count failed:", error.message);
    return 0;
  }

  return count ?? 0;
}
