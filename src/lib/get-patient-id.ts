import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns { userId, patientId, supabase } for the current authenticated user.
 * Auto-creates patient record if profile exists but has no patient_id.
 * Throws if not authenticated.
 */
export async function getSessionPatient(): Promise<{
  userId: string;
  patientId: string;
  supabase: SupabaseClient;
}> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("patient_id, display_name")
    .eq("user_id", user.id)
    .single();

  if (profile?.patient_id) {
    return { userId: user.id, patientId: profile.patient_id, supabase };
  }

  // Auto-create patient if profile exists but patient_id is missing
  const sb = createServiceClient();
  const displayName = profile?.display_name || user.user_metadata?.display_name || "";

  // If no profile at all, create one
  if (!profile) {
    const { data: patient } = await sb
      .from("patients")
      .insert({ display_name: displayName })
      .select("id")
      .single();
    if (!patient) throw new Error("Failed to create patient");

    await sb.from("profiles").insert({
      user_id: user.id,
      role: "patient",
      display_name: displayName,
      patient_id: patient.id,
    });

    return { userId: user.id, patientId: patient.id, supabase };
  }

  // Profile exists but no patient — create patient and link
  const { data: patient } = await sb
    .from("patients")
    .insert({ display_name: displayName })
    .select("id")
    .single();
  if (!patient) throw new Error("Failed to create patient");

  await sb
    .from("profiles")
    .update({ patient_id: patient.id })
    .eq("user_id", user.id);

  return { userId: user.id, patientId: patient.id, supabase };
}
