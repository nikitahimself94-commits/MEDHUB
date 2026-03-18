"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveOnboardingContext(answers: Record<string, string>) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_context: answers })
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/ai-chat");
}

export async function completeOnboarding(answers: Record<string, string>) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Save context + mark as completed
  // onboarding_completed_at may not exist yet (migration pending) — handle gracefully
  const updatePayload: Record<string, unknown> = {
    onboarding_context: answers,
  };

  // Try setting completed_at — if column doesn't exist, update will fail silently
  const { error: fullErr } = await supabase
    .from("profiles")
    .update({ ...updatePayload, onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (fullErr) {
    // Fallback: save just context without completed_at
    await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("user_id", user.id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/ai-chat");
}
