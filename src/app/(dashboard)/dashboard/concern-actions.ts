"use server";

import { getSessionPatient } from "@/lib/get-patient-id";
import { revalidatePath } from "next/cache";

export async function createConcern(formData: FormData) {
  const { patientId, supabase } = await getSessionPatient();

  const title = (formData.get("title") as string)?.trim();
  if (!title) return;

  const keyQuestion = (formData.get("key_question") as string)?.trim() || "";

  // Read existing concern to detect changes
  const { data: existing } = await supabase
    .from("active_concerns")
    .select("id, title, key_question")
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!existing) {
    // ── FIRST CREATE: insert new concern ──
    await supabase
      .from("active_concerns")
      .insert({ patient_id: patientId, title, key_question: keyQuestion });

  } else if (
    existing.title.trim() === title &&
    (existing.key_question || "").trim() === keyQuestion
  ) {
    // ── UNCHANGED: skip write, preserve updated_at ──
    revalidatePath("/dashboard");
    return;

  } else {
    // ── CHANGED: delete stale hypothesis BEFORE updating concern ──
    const { error: delError } = await supabase
      .from("hypotheses")
      .delete()
      .eq("concern_id", existing.id);

    if (delError) return;

    await supabase
      .from("active_concerns")
      .update({
        title,
        key_question: keyQuestion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/test-hypothesis");
}

export async function updateConcernStatus(status: string): Promise<void> {
  const validStatuses = ["active", "paused", "resolved"];
  if (!validStatuses.includes(status)) return;

  const { patientId, supabase } = await getSessionPatient();

  const { data: existing } = await supabase
    .from("active_concerns")
    .select("id")
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!existing) return;

  const { error } = await supabase
    .from("active_concerns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", existing.id);

  if (error) return;

  revalidatePath("/dashboard");
}

export async function clearConcern(): Promise<void> {
  const { patientId, supabase } = await getSessionPatient();

  const { data: existing } = await supabase
    .from("active_concerns")
    .select("id")
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!existing) return;

  // Delete concern — hypothesis removed via FK cascade
  const { error } = await supabase
    .from("active_concerns")
    .delete()
    .eq("id", existing.id);

  if (error) return;

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/test-hypothesis");
}
