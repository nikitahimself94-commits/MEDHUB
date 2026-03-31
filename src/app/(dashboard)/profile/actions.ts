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

  const sex = (formData.get("sex") as string) || null;
  const birthDate = (formData.get("birth_date") as string) || null;
  const heightRaw = formData.get("height_cm") as string;
  const heightCm = heightRaw ? parseInt(heightRaw, 10) || null : null;
  const weightRaw = formData.get("baseline_weight_kg") as string;
  const baselineWeightKg = weightRaw ? parseFloat(weightRaw) || null : null;
  const familyRiskRaw = (formData.get("family_risk_categories") as string) || "";
  const familyRiskCategories = familyRiskRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const smokingStatus = (formData.get("smoking_status") as string) || "unknown";
  const alcoholStatus = (formData.get("alcohol_status") as string) || "unknown";
  const functionalBaseline = (formData.get("functional_baseline") as string) || null;
  const diagnosesRaw = (formData.get("diagnoses") as string) || "";
  const diagnoses = diagnosesRaw.split("\n").map((s) => s.trim()).filter(Boolean);
  const opsRaw = (formData.get("operations_hospitalizations") as string) || "";
  const operationsHospitalizations = opsRaw.split("\n").map((s) => s.trim()).filter(Boolean);

  const row = {
    patient_id: patientId,
    blood_type: bloodType,
    rh_factor: rhFactor,
    allergies,
    chronic_conditions: chronicConditions,
    emergency_info: emergencyInfo,
    sex,
    birth_date: birthDate,
    height_cm: heightCm,
    baseline_weight_kg: baselineWeightKg,
    family_risk_categories: familyRiskCategories,
    smoking_status: smokingStatus,
    alcohol_status: alcoholStatus,
    functional_baseline: functionalBaseline,
    diagnoses,
    operations_hospitalizations: operationsHospitalizations,
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
