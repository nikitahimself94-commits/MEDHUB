/**
 * Fetches active concern + latest hypothesis context for companion blocks in data-entry modules.
 * Returns null if no relevant context for the given page href.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

interface CompanionData {
  concernTitle: string;
  concernQuestion: string;
  reason: string;
  missingSignal: string | null;
  hypothesisStatus: string;
}

export async function getCompanionContext(
  supabase: SupabaseClient,
  patientId: string,
  pageHref: string,
): Promise<CompanionData | null> {
  const { data: concern } = await supabase
    .from("active_concerns")
    .select("id, title, key_question")
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!concern) return null;

  // Explicitly select latest hypothesis by updated_at desc
  const { data: hyp } = await supabase
    .from("hypotheses")
    .select("missing, next_step, status, updated_at")
    .eq("concern_id", concern.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!hyp) return null;

  const nextStep = hyp.next_step as { text?: string; reason?: string; href?: string } | null;
  if (!nextStep?.href || nextStep.href !== pageHref) return null;

  const missing = Array.isArray(hyp.missing) ? hyp.missing as { signal: string }[] : [];

  return {
    concernTitle: concern.title,
    concernQuestion: concern.key_question || "",
    reason: nextStep.reason || nextStep.text || "",
    missingSignal: missing[0]?.signal ?? null,
    hypothesisStatus: hyp.status ?? "",
  };
}
