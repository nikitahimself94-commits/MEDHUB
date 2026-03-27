"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * DEV-ONLY: Reset onboarding + first-arrival state for current user.
 * Clears profile flags AND product data so the full flow replays.
 * Guarded: does nothing in production builds.
 */
export async function resetReviewState(): Promise<{ ok: boolean; error?: string }> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "Disabled in production" };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Get patient_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("patient_id")
    .eq("user_id", user.id)
    .single();
  if (!profile?.patient_id) return { ok: false, error: "No patient_id" };

  const pid = profile.patient_id;

  // 1. Clear onboarding flags
  await supabase
    .from("profiles")
    .update({ onboarding_completed_at: null, onboarding_context: null })
    .eq("user_id", user.id);

  // 2. Delete product data (so hasProductData = false → onboarding gate shows)
  await Promise.all([
    supabase.from("diary_entries").delete().eq("patient_id", pid),
    supabase.from("vitals").delete().eq("patient_id", pid),
    supabase.from("medications").delete().eq("patient_id", pid),
    supabase.from("documents").delete().eq("patient_id", pid),
    supabase.from("timeline_events").delete().eq("patient_id", pid),
    supabase.from("medication_intakes").delete().eq("patient_id", pid),
    supabase.from("doctor_visit_preps").delete().eq("patient_id", pid),
    supabase.from("emotion_entries").delete().eq("patient_id", pid),
    supabase.from("ai_chat_messages").delete().eq("patient_id", pid),
    supabase.from("ai_usage_events").delete().eq("patient_id", pid),
  ]);

  revalidatePath("/dashboard");
  return { ok: true };
}
