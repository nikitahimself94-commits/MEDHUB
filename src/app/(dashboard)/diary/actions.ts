"use server";

import { getSessionPatient } from "@/lib/get-patient-id";
import { revalidatePath } from "next/cache";

function parseCommaSeparated(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse sleep hours: supports "7", "7.5", "6-7" (returns midpoint), "6,5" */
function parseSleepHours(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  // Range like "6-7" or "6.5-8"
  const rangeMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]);
    const hi = parseFloat(rangeMatch[2]);
    if (!isNaN(lo) && !isNaN(hi)) return Math.round(((lo + hi) / 2) * 10) / 10;
  }
  const val = parseFloat(trimmed);
  return isNaN(val) ? null : val;
}

export async function createDiaryEntry(formData: FormData) {
  const { userId, patientId, supabase } = await getSessionPatient();

  const wellbeingScore = parseInt(formData.get("wellbeing_score") as string, 10);
  const symptomsRaw = (formData.get("symptoms") as string) || "";
  const painLocation = (formData.get("pain_location") as string) || null;
  const painScoreRaw = formData.get("pain_score") as string;
  const sleepHoursRaw = formData.get("sleep_hours") as string;
  const sleepQualityRaw = formData.get("sleep_quality") as string;
  const notes = (formData.get("notes") as string) || null;
  const tagsRaw = (formData.get("tags") as string) || "";

  const painScore = painScoreRaw ? parseInt(painScoreRaw, 10) : null;
  const sleepHours = sleepHoursRaw ? parseSleepHours(sleepHoursRaw) : null;
  const sleepQuality = sleepQualityRaw ? parseInt(sleepQualityRaw, 10) : null;

  // Parse structured symptoms from form JSON
  const structuredRaw = (formData.get("structured_symptoms") as string) || "[]";
  let structuredSymptoms: { name: string; started_at_text: string; duration_text: string; frequency: string; intensity: string; triggers: string; associated_symptoms: string; functional_impact: string }[];
  try {
    const parsed = JSON.parse(structuredRaw);
    structuredSymptoms = Array.isArray(parsed) ? parsed.filter((s: Record<string, unknown>) => typeof s.name === "string" && s.name.trim()) : [];
  } catch {
    structuredSymptoms = [];
  }

  // Sync legacy symptoms text[] from structured + freeform
  const legacyFromStructured = structuredSymptoms.map((s) => s.name.trim()).filter(Boolean);
  const legacyFromFreeform = parseCommaSeparated(symptomsRaw);
  const allSymptomNames = Array.from(new Set([...legacyFromStructured, ...legacyFromFreeform]));

  // Parse lifestyle context
  const lifestyleRaw = (formData.get("lifestyle_context") as string) || "{}";
  let lifestyleContext: Record<string, string>;
  try {
    const parsed = JSON.parse(lifestyleRaw);
    lifestyleContext = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    lifestyleContext = {};
  }

  // Parse exposures
  const exposuresRaw = (formData.get("exposures") as string) || "[]";
  let exposures: { type: string; details: string }[];
  try {
    const parsed = JSON.parse(exposuresRaw);
    exposures = Array.isArray(parsed) ? parsed.filter((e: Record<string, unknown>) => typeof e.type === "string" && e.type.trim()) : [];
  } catch {
    exposures = [];
  }

  const { data: activeConcern } = await supabase.from("active_concerns").select("id, status").eq("patient_id", patientId).maybeSingle();
  const concernId = activeConcern?.status === "active" ? activeConcern.id : null;

  const { error } = await supabase.from("diary_entries").insert({
    patient_id: patientId,
    created_by: userId,
    concern_id: concernId,
    wellbeing_score: wellbeingScore,
    symptoms: allSymptomNames,
    structured_symptoms: structuredSymptoms,
    pain_location: painLocation,
    pain_score: painScore,
    sleep_hours: sleepHours,
    sleep_quality: sleepQuality,
    notes,
    tags: parseCommaSeparated(tagsRaw),
    lifestyle_context: lifestyleContext,
    exposures,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/diary");
}

export async function deleteDiaryEntry(id: string) {
  const { supabase } = await getSessionPatient();

  const { error } = await supabase.from("diary_entries").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/diary");
}
