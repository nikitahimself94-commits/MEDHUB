import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns { userId, patientId, supabase } for the current authenticated user.
 * Throws if not authenticated or profile has no patient_id.
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
    .select("patient_id")
    .eq("user_id", user.id)
    .single();

  if (!profile?.patient_id) throw new Error("No patient linked");

  return { userId: user.id, patientId: profile.patient_id, supabase };
}
