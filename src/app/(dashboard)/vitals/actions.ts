"use server";

import { getSessionPatient } from "@/lib/get-patient-id";
import { revalidatePath } from "next/cache";

export async function createVital(formData: FormData) {
  const { userId, patientId, supabase } = await getSessionPatient();

  const vitalType = formData.get("vital_type") as string;
  const value = formData.get("value") as string;
  const unit = formData.get("unit") as string;
  const measuredAt = (formData.get("measured_at") as string) || new Date().toISOString();
  const notes = (formData.get("notes") as string) || null;

  const { error } = await supabase.from("vitals").insert({
    patient_id: patientId,
    created_by: userId,
    vital_type: vitalType,
    value,
    unit,
    measured_at: measuredAt,
    notes,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/vitals");
}

export async function deleteVital(id: string) {
  const { patientId, supabase } = await getSessionPatient();

  const { error } = await supabase
    .from("vitals")
    .delete()
    .eq("id", id)
    .eq("patient_id", patientId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/vitals");
}
