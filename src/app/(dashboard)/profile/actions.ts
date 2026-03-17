"use server";

import { getSessionPatient } from "@/lib/get-patient-id";
import { revalidatePath } from "next/cache";

export async function upsertMedicalProfile(formData: FormData) {
  const { patientId, supabase } = await getSessionPatient();

  const bloodType = (formData.get("blood_type") as string) || null;
  const rhFactor = (formData.get("rh_factor") as string) || null;
  const allergiesRaw = (formData.get("allergies") as string) || "[]";
  const chronicRaw = (formData.get("chronic_conditions") as string) || "[]";
  const emergencyInfo = (formData.get("emergency_info") as string) || null;

  let allergies: unknown[];
  let chronicConditions: unknown[];

  try {
    allergies = JSON.parse(allergiesRaw);
  } catch {
    allergies = [];
  }

  try {
    chronicConditions = JSON.parse(chronicRaw);
  } catch {
    chronicConditions = [];
  }

  const row = {
    patient_id: patientId,
    blood_type: bloodType,
    rh_factor: rhFactor,
    allergies,
    chronic_conditions: chronicConditions,
    emergency_info: emergencyInfo,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("medical_profile")
    .upsert(row, { onConflict: "patient_id" });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/profile");
}
