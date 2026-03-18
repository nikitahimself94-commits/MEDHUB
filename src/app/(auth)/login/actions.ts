"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function login(formData: FormData) {
  const supabase = createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = (formData.get("display_name") as string)?.trim() || "";

  if (!email || !password) {
    redirect("/login?mode=signup&error=" + encodeURIComponent("Email и пароль обязательны"));
  }

  if (password.length < 6) {
    redirect("/login?mode=signup&error=" + encodeURIComponent("Пароль должен быть не менее 6 символов"));
  }

  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, role: "patient" },
    },
  });

  if (error) {
    redirect("/login?mode=signup&error=" + encodeURIComponent(error.message));
  }

  // If trigger didn't create patient (migration not yet applied), do it manually
  const userId = signUpData.user?.id;
  if (userId) {
    await ensurePatientExists(userId, displayName);
  }

  redirect("/dashboard");
}

/** Ensure a patient record exists for the user. Uses service role to bypass RLS. */
async function ensurePatientExists(userId: string, displayName: string) {
  const sb = createServiceClient();

  const { data: profile } = await sb
    .from("profiles")
    .select("patient_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.patient_id) return; // Already linked

  // Create patient
  const { data: patient, error: patientErr } = await sb
    .from("patients")
    .insert({ display_name: displayName })
    .select("id")
    .single();

  if (patientErr || !patient) return;

  // Link profile to patient
  await sb
    .from("profiles")
    .update({ patient_id: patient.id })
    .eq("user_id", userId);
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
