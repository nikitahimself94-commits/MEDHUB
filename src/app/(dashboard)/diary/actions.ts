"use server";

import { getSessionPatient } from "@/lib/get-patient-id";
import { revalidatePath } from "next/cache";

function parseCommaSeparated(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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
  const sleepHours = sleepHoursRaw ? parseFloat(sleepHoursRaw) : null;
  const sleepQuality = sleepQualityRaw ? parseInt(sleepQualityRaw, 10) : null;

  const { error } = await supabase.from("diary_entries").insert({
    patient_id: patientId,
    created_by: userId,
    wellbeing_score: wellbeingScore,
    symptoms: parseCommaSeparated(symptomsRaw),
    pain_location: painLocation,
    pain_score: painScore,
    sleep_hours: sleepHours,
    sleep_quality: sleepQuality,
    notes,
    tags: parseCommaSeparated(tagsRaw),
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
