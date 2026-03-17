"use server";

import { getSessionPatient } from "@/lib/get-patient-id";
import { revalidatePath } from "next/cache";

export async function createTimelineEvent(formData: FormData) {
  const { userId, patientId, supabase } = await getSessionPatient();

  const eventType = formData.get("event_type") as string;
  const eventDate = formData.get("event_date") as string;
  const title = (formData.get("title") as string).trim();
  const notes = (formData.get("notes") as string) || null;

  if (!title) throw new Error("Заголовок обязателен");
  if (!eventDate) throw new Error("Дата обязательна");

  const { error } = await supabase.from("timeline_events").insert({
    patient_id: patientId,
    created_by: userId,
    event_type: eventType,
    event_date: eventDate,
    title,
    notes,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/timeline");
}

export async function deleteTimelineEvent(id: string) {
  const { patientId, supabase } = await getSessionPatient();

  const { error } = await supabase
    .from("timeline_events")
    .delete()
    .eq("id", id)
    .eq("patient_id", patientId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/timeline");
}
