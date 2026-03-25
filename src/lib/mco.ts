import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// MCO v1 — Medical Context Object (data-only current snapshot)
// ---------------------------------------------------------------------------

export type GreetingContextKey =
  | "first_visit"
  | "returned_today"
  | "returned_after_1_2_days"
  | "returned_after_3_plus_days"
  | "returned_after_long_absence_with_data"
  | "returned_evening_prompt";

export type PriorityActionKey =
  | "add_diary"
  | "add_vitals"
  | "upload_document"
  | "add_medications"
  | "add_emotions"
  | "update_diary"
  | "none";

export interface McoDataCompleteness {
  vitals: number;       // 0..1
  diary: number;        // 0..1
  documents: number;    // 0..1
  medications: number;  // 0..1
  symptoms: number;     // 0..1
  emotions: number;     // 0..1
}

export interface McoSnapshot {
  entry_mode: string | null;
  current_focus: string | null;
  last_seen: string | null;
  days_absent: number;                        // 0 = active today, -1 = never
  time_of_day: "morning" | "day" | "evening" | "night";
  data_completeness: McoDataCompleteness;
  greeting_context: GreetingContextKey;
  priority_action: PriorityActionKey;
  updated_at: string;
}

const MCO_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns cached MCO snapshot or rebuilds if stale / missing.
 * Persists result to profiles.mco_snapshot + mco_updated_at.
 */
export async function getOrRefreshMco(
  supabase: SupabaseClient,
  patientId: string,
): Promise<McoSnapshot> {
  // 1. Try cached
  const { data: row } = await supabase
    .from("profiles")
    .select("mco_snapshot, mco_updated_at")
    .eq("patient_id", patientId)
    .limit(1)
    .maybeSingle();

  if (row?.mco_snapshot && row.mco_updated_at) {
    const age = Date.now() - new Date(row.mco_updated_at).getTime();
    if (age < MCO_TTL_MS) {
      return row.mco_snapshot as McoSnapshot;
    }
  }

  // 2. Rebuild
  const mco = await buildMcoSnapshot(supabase, patientId);

  // 3. Persist explicitly
  const { error } = await supabase
    .from("profiles")
    .update({
      mco_snapshot: mco as unknown as Record<string, unknown>,
      mco_updated_at: mco.updated_at,
    })
    .eq("patient_id", patientId);

  if (error) {
    console.error("[MCO] Failed to persist snapshot:", error.message);
  }

  return mco;
}

// ---------------------------------------------------------------------------
// Builder (deterministic, no AI)
// ---------------------------------------------------------------------------

/** Capped count thresholds for normalized completeness */
const CAPS = {
  diary: 5,
  vitals: 5,
  documents: 3,
  medications: 2,
  emotions: 3,
} as const;

async function buildMcoSnapshot(
  supabase: SupabaseClient,
  patientId: string,
): Promise<McoSnapshot> {
  // Parallel fetch: counts + latest timestamps
  const [
    { data: profile },
    { data: diary },
    { count: diaryCount },
    { data: vitals },
    { count: vitalsCount },
    { data: docs },
    { count: docsCount },
    { count: medsCount },
    { data: emotions },
    { count: emotionsCount },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, onboarding_context")
      .eq("patient_id", patientId)
      .limit(1)
      .maybeSingle(),
    // diary: latest row for timestamp + symptoms check
    supabase
      .from("diary_entries")
      .select("created_at, symptoms")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1),
    // diary: count
    supabase
      .from("diary_entries")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId),
    // vitals: latest row for timestamp
    supabase
      .from("vitals")
      .select("measured_at")
      .eq("patient_id", patientId)
      .order("measured_at", { ascending: false })
      .limit(1),
    // vitals: count
    supabase
      .from("vitals")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId),
    // documents: latest row for timestamp
    supabase
      .from("documents")
      .select("created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1),
    // documents: count
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId),
    // medications: count of active
    supabase
      .from("medications")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("active", true),
    // emotions: latest row for timestamp
    supabase
      .from("emotion_entries")
      .select("created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1),
    // emotions: count
    supabase
      .from("emotion_entries")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId),
  ]);

  const now = new Date();
  const onbCtx = profile?.onboarding_context as Record<string, string> | null;

  // --- entry_mode / current_focus ---
  const entry_mode = onbCtx?.entry_mode ?? null;
  const current_focus = onbCtx?.current_focus ?? null;

  // --- last_seen / days_absent ---
  const timestamps: number[] = [];
  if (diary?.[0]?.created_at) timestamps.push(new Date(diary[0].created_at).getTime());
  if (vitals?.[0]?.measured_at) timestamps.push(new Date(vitals[0].measured_at).getTime());
  if (docs?.[0]?.created_at) timestamps.push(new Date(docs[0].created_at).getTime());
  if (emotions?.[0]?.created_at) timestamps.push(new Date(emotions[0].created_at).getTime());

  const lastSeenMs = timestamps.length > 0 ? Math.max(...timestamps) : null;
  const last_seen = lastSeenMs ? new Date(lastSeenMs).toISOString() : null;
  const days_absent = lastSeenMs
    ? Math.floor((now.getTime() - lastSeenMs) / (24 * 60 * 60 * 1000))
    : -1;

  // --- time_of_day ---
  const time_of_day = resolveTimeOfDay();

  // --- data_completeness (normalized 0..1, capped heuristics) ---
  const hasSymptomsInDiary = (diary?.[0]?.symptoms?.length ?? 0) > 0;
  // symptoms score: 0.5 if diary exists but no symptoms, 1.0 if diary has symptoms
  const symptomsRaw = (diaryCount ?? 0) > 0 ? (hasSymptomsInDiary ? 1.0 : 0.5) : 0;

  const data_completeness: McoDataCompleteness = {
    diary: cappedScore(diaryCount ?? 0, CAPS.diary),
    vitals: cappedScore(vitalsCount ?? 0, CAPS.vitals),
    documents: cappedScore(docsCount ?? 0, CAPS.documents),
    medications: cappedScore(medsCount ?? 0, CAPS.medications),
    symptoms: symptomsRaw,
    emotions: cappedScore(emotionsCount ?? 0, CAPS.emotions),
  };

  // --- greeting_context ---
  const greeting_context = resolveGreetingContext(days_absent, time_of_day, data_completeness);

  // --- priority_action ---
  const priority_action = resolvePriorityAction(data_completeness, days_absent);

  return {
    entry_mode,
    current_focus,
    last_seen,
    days_absent,
    time_of_day,
    data_completeness,
    greeting_context,
    priority_action,
    updated_at: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns value/cap clamped to [0, 1], rounded to 2 decimals */
function cappedScore(count: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.round(Math.min(count / cap, 1) * 100) / 100;
}

function resolveTimeOfDay(): McoSnapshot["time_of_day"] {
  let hour: number;
  try {
    const tz = cookies().get("tz")?.value;
    if (tz) {
      const localTime = new Date().toLocaleTimeString("en-GB", { timeZone: tz, hour12: false });
      hour = parseInt(localTime.split(":")[0], 10);
    } else {
      hour = new Date().getUTCHours();
    }
  } catch {
    hour = new Date().getUTCHours();
  }

  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

function resolveGreetingContext(
  daysAbsent: number,
  timeOfDay: McoSnapshot["time_of_day"],
  completeness: McoDataCompleteness,
): GreetingContextKey {
  if (daysAbsent === -1) return "first_visit";
  if (daysAbsent === 0) {
    if (timeOfDay === "evening" || timeOfDay === "night") return "returned_evening_prompt";
    return "returned_today";
  }
  if (daysAbsent <= 2) return "returned_after_1_2_days";

  // 3+ days absent
  const filledLayers = Object.values(completeness).filter((v) => v > 0).length;
  if (filledLayers >= 3) return "returned_after_long_absence_with_data";
  return "returned_after_3_plus_days";
}

function resolvePriorityAction(
  completeness: McoDataCompleteness,
  daysAbsent: number,
): PriorityActionKey {
  if (completeness.diary === 0) return "add_diary";
  if (completeness.vitals === 0) return "add_vitals";
  if (completeness.documents === 0) return "upload_document";
  if (completeness.medications === 0) return "add_medications";
  if (completeness.emotions === 0) return "add_emotions";

  // All layers have some data — suggest diary refresh if absent
  if (daysAbsent >= 1) return "update_diary";

  return "none";
}
