"use server";

import { getSessionPatient } from "@/lib/get-patient-id";
import { revalidatePath } from "next/cache";

export async function createMedication(formData: FormData) {
  const { userId, patientId, supabase } = await getSessionPatient();

  const name = formData.get("name") as string;
  const dosage = (formData.get("dosage") as string) || "";
  const schedule = (formData.get("schedule") as string) || "";
  const startDate = formData.get("start_date") as string;
  const endDate = (formData.get("end_date") as string) || null;
  const active = formData.get("active") === "true";
  const notes = (formData.get("notes") as string) || null;
  const purpose = (formData.get("purpose") as string) || "";
  const effect = (formData.get("effect") as string) || "";
  const sideEffects = (formData.get("side_effects") as string) || "";
  const therapyChanges = (formData.get("therapy_changes") as string) || "";

  const { error } = await supabase.from("medications").insert({
    patient_id: patientId,
    created_by: userId,
    name,
    dosage,
    schedule,
    start_date: startDate,
    end_date: endDate,
    active,
    notes,
    purpose,
    effect,
    side_effects: sideEffects,
    therapy_changes: therapyChanges,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/medications");
}

export async function recordIntake(medicationId: string) {
  const { userId, patientId, supabase } = await getSessionPatient();

  const { error } = await supabase.from("medication_intakes").insert({
    patient_id: patientId,
    medication_id: medicationId,
    created_by: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/medications");
}

export async function toggleMedicationActive(id: string) {
  const { patientId, supabase } = await getSessionPatient();

  const { data: med, error: fetchErr } = await supabase
    .from("medications")
    .select("active")
    .eq("id", id)
    .eq("patient_id", patientId)
    .single();

  if (fetchErr || !med) {
    throw new Error("Препарат не найден");
  }

  const { error } = await supabase
    .from("medications")
    .update({ active: !med.active })
    .eq("id", id)
    .eq("patient_id", patientId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/medications");
}

export async function updateMedication(
  id: string,
  fields: {
    name: string;
    dosage: string;
    schedule: string;
    start_date: string;
    end_date: string | null;
    notes: string | null;
    purpose: string;
    effect: string;
    side_effects: string;
    therapy_changes: string;
  }
) {
  const { patientId, supabase } = await getSessionPatient();

  const { error } = await supabase
    .from("medications")
    .update({
      name: fields.name,
      dosage: fields.dosage,
      schedule: fields.schedule,
      start_date: fields.start_date,
      end_date: fields.end_date,
      notes: fields.notes,
      purpose: fields.purpose,
      effect: fields.effect,
      side_effects: fields.side_effects,
      therapy_changes: fields.therapy_changes,
    })
    .eq("id", id)
    .eq("patient_id", patientId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/medications");
}

export async function deleteMedication(id: string) {
  const { patientId, supabase } = await getSessionPatient();

  const { error } = await supabase
    .from("medications")
    .delete()
    .eq("id", id)
    .eq("patient_id", patientId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/medications");
}

export async function undoLastIntake(medicationId: string) {
  const { patientId, supabase } = await getSessionPatient();

  const { data: last } = await supabase
    .from("medication_intakes")
    .select("id")
    .eq("patient_id", patientId)
    .eq("medication_id", medicationId)
    .order("taken_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) return;

  const { error } = await supabase
    .from("medication_intakes")
    .delete()
    .eq("id", last.id)
    .eq("patient_id", patientId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/medications");
}
