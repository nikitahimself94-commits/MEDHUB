import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with service role key.
 * Bypasses RLS — use only for trusted server-side operations
 * like public share pages where there is no authenticated user.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
