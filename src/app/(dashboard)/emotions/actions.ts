"use server";

import { getSessionPatient } from "@/lib/get-patient-id";
import { revalidatePath } from "next/cache";

export async function createEmotionEntry(formData: FormData) {
  const { userId, patientId, supabase } = await getSessionPatient();

  const anxiety = Number(formData.get("anxiety"));
  const depression = Number(formData.get("depression"));
  const calmness = Number(formData.get("calmness"));
  const fatigue = Number(formData.get("fatigue"));
  const hope = Number(formData.get("hope"));
  const notes = (formData.get("notes") as string) || null;

  const { error } = await supabase.from("emotion_entries").insert({
    patient_id: patientId,
    created_by: userId,
    anxiety,
    depression,
    calmness,
    fatigue,
    hope,
    notes,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/emotions");
}

export async function deleteEmotionEntry(id: string) {
  const { patientId, supabase } = await getSessionPatient();

  const { error } = await supabase
    .from("emotion_entries")
    .delete()
    .eq("id", id)
    .eq("patient_id", patientId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/emotions");
}
