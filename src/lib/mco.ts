import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ServerRotation } from "@/lib/template-rotation";

// ---------------------------------------------------------------------------
// MCO v2 — Medical Context Object (data-only current snapshot)
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

export interface McoCorrelation {
  from: string;
  to: string;
  description: string;
}

export interface McoSnapshot {
  // --- v1 fields ---
  entry_mode: string | null;
  current_focus: string | null;
  last_seen: string | null;
  days_absent: number;                        // 0 = active today, -1 = never
  time_of_day: "morning" | "day" | "evening" | "night";
  data_completeness: McoDataCompleteness;
  greeting_context: GreetingContextKey;
  priority_action: PriorityActionKey;
  updated_at: string;
  // --- v2 fields (foundation — populated with safe defaults for now) ---
  name: string;
  recent_patterns: string[];
  open_questions: string[];
  pending_nudges: string[];
  correlations: McoCorrelation[];
  last_used_templates: string[];
}

const MCO_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Normalizer — guarantees v2 defaults on any snapshot (cached or fresh)
// ---------------------------------------------------------------------------

function normalizeMcoSnapshot(raw: Record<string, unknown>): McoSnapshot {
  return {
    // v1 fields — pass through
    entry_mode: (raw.entry_mode as string) ?? null,
    current_focus: (raw.current_focus as string) ?? null,
    last_seen: (raw.last_seen as string) ?? null,
    days_absent: (raw.days_absent as number) ?? -1,
    time_of_day: (raw.time_of_day as McoSnapshot["time_of_day"]) ?? "day",
    data_completeness: (raw.data_completeness as McoDataCompleteness) ?? {
      vitals: 0, diary: 0, documents: 0, medications: 0, symptoms: 0, emotions: 0,
    },
    greeting_context: (raw.greeting_context as GreetingContextKey) ?? "first_visit",
    priority_action: (raw.priority_action as PriorityActionKey) ?? "add_diary",
    updated_at: (raw.updated_at as string) ?? new Date().toISOString(),
    // v2 fields — safe defaults if missing from old cached JSON
    name: (raw.name as string) ?? "",
    recent_patterns: (raw.recent_patterns as string[]) ?? [],
    open_questions: (raw.open_questions as string[]) ?? [],
    pending_nudges: (raw.pending_nudges as string[]) ?? [],
    correlations: (raw.correlations as McoCorrelation[]) ?? [],
    last_used_templates: (raw.last_used_templates as string[]) ?? [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns cached MCO snapshot or rebuilds if stale / missing.
 * All returned snapshots are normalized to MCO v2 shape.
 * Persists result to profiles.mco_snapshot + mco_updated_at.
 */
export async function getOrRefreshMco(
  supabase: SupabaseClient,
  patientId: string,
): Promise<McoSnapshot> {
  // 1. Try cached (fail-safe: columns may not exist if migration 00026 not applied)
  try {
    const { data: row } = await supabase
      .from("profiles")
      .select("mco_snapshot, mco_updated_at")
      .eq("patient_id", patientId)
      .limit(1)
      .maybeSingle();

    if (row?.mco_snapshot && row.mco_updated_at) {
      const age = Date.now() - new Date(row.mco_updated_at).getTime();
      if (age < MCO_TTL_MS) {
        return normalizeMcoSnapshot(row.mco_snapshot as Record<string, unknown>);
      }
    }
  } catch {
    // Columns don't exist yet — proceed to rebuild
  }

  // 2. Rebuild + normalize for hard guarantee
  const mco = normalizeMcoSnapshot(
    await buildMcoSnapshot(supabase, patientId) as unknown as Record<string, unknown>,
  );

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

  // Separate query for companion_rotation_state (migration 00027).
  // Isolated so that a failure here does not break the rest of the MCO build.
  // Risk: if migration 00027 is not applied, Supabase may return an error
  // (e.g. column does not exist). We handle both { error } and thrown
  // exceptions to guarantee a non-fatal fallback.
  let recentTemplates: string[] = [];
  try {
    const { data: rotRow, error: rotErr } = await supabase
      .from("profiles")
      .select("companion_rotation_state")
      .eq("patient_id", patientId)
      .limit(1)
      .maybeSingle();

    if (rotErr) {
      console.error("[MCO] Failed to read rotation state:", rotErr.message);
    } else {
      recentTemplates = ServerRotation.extractRecentTemplates(
        rotRow?.companion_rotation_state as Record<string, unknown> | null,
      );
    }
  } catch (err) {
    console.error("[MCO] Unexpected error reading rotation state:", err);
  }

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

  // --- recent_patterns (deterministic, max 3) ---
  const recent_patterns = deriveRecentPatterns(data_completeness, days_absent, medsCount ?? 0);

  // --- open_questions (deterministic gaps, max 3) ---
  const open_questions = deriveOpenQuestions(data_completeness, days_absent);

  // --- pending_nudges (deterministic actionable nudges, max 3) ---
  const pending_nudges = derivePendingNudges(data_completeness, days_absent, medsCount ?? 0);

  // --- correlations (structural data-layer overlaps, max 3) ---
  const correlations = deriveCorrelations(data_completeness, medsCount ?? 0);

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
    // v2 fields
    name: profile?.display_name ?? "",
    recent_patterns,
    open_questions,
    pending_nudges,
    correlations,
    last_used_templates: recentTemplates,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive up to 3 factual patterns from diary/vitals/meds/docs only. */
function deriveRecentPatterns(
  c: McoDataCompleteness,
  daysAbsent: number,
  activeMedsCount: number,
): string[] {
  const out: string[] = [];
  if (c.diary > 0) out.push("Есть записи в дневнике");
  if (c.vitals > 0) out.push("Есть данные показателей");
  if (activeMedsCount > 0) out.push("Есть активные лекарства");
  if (out.length < 3 && c.documents > 0) out.push("Документы уже загружены");
  const hasAnyData = c.diary > 0 || c.vitals > 0 || c.documents > 0 || activeMedsCount > 0;
  if (out.length < 3 && hasAnyData && daysAbsent >= 3 && daysAbsent !== -1) {
    out.push("Данные вносятся нерегулярно");
  }
  return out.slice(0, 3);
}

/** Derive up to 3 concrete data gaps from diary/vitals/docs only. */
function deriveOpenQuestions(
  c: McoDataCompleteness,
  daysAbsent: number,
): string[] {
  const hasAnyData = c.diary > 0 || c.vitals > 0 || c.documents > 0;
  const out: string[] = [];
  if (c.diary === 0) out.push("Дневник пока пустой");
  if (c.vitals === 0) out.push("Нет ни одного показателя");
  if (c.documents === 0) out.push("Пока нет ни одного документа");
  if (out.length < 3 && hasAnyData && daysAbsent >= 7) {
    out.push("Давно не было новых записей");
  }
  return out.slice(0, 3);
}

/** Derive up to 3 actionable nudges from diary/vitals/docs/meds only. */
function derivePendingNudges(
  c: McoDataCompleteness,
  daysAbsent: number,
  activeMedsCount: number,
): string[] {
  const hasAnyData = c.diary > 0 || c.vitals > 0 || c.documents > 0;
  const out: string[] = [];
  if (c.diary === 0) out.push("Добавь первую запись в дневник");
  if (c.vitals === 0) out.push("Добавь первый показатель");
  if (out.length < 3 && c.documents === 0) out.push("Загрузи первый документ");
  if (out.length < 3 && hasAnyData && daysAbsent >= 7) {
    out.push("Обнови данные — давно не было записей");
  }
  if (out.length < 3 && activeMedsCount > 0 && daysAbsent >= 7) {
    out.push("Проверь, актуальны ли лекарства");
  }
  return out.slice(0, 3);
}

/** Derive up to 3 structural data-layer correlations. Only emitted when both sides have data. */
function deriveCorrelations(
  c: McoDataCompleteness,
  activeMedsCount: number,
): McoCorrelation[] {
  const hasDiary = c.diary > 0;
  const hasVitals = c.vitals > 0;
  const hasDocs = c.documents > 0;
  const hasMeds = activeMedsCount > 0;

  const candidates: McoCorrelation[] = [];
  if (hasDiary && hasVitals)
    candidates.push({ from: "diary", to: "vitals", description: "Есть и записи самочувствия, и показатели" });
  if (hasDocs && hasVitals)
    candidates.push({ from: "documents", to: "vitals", description: "Есть документы и данные показателей" });
  if (hasMeds && hasDiary)
    candidates.push({ from: "medications", to: "diary", description: "Есть лекарства и записи самочувствия" });
  if (hasMeds && hasVitals)
    candidates.push({ from: "medications", to: "vitals", description: "Есть лекарства и данные показателей" });
  if (hasDocs && hasMeds)
    candidates.push({ from: "documents", to: "medications", description: "Есть документы и лекарства" });

  return candidates.slice(0, 3);
}

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
