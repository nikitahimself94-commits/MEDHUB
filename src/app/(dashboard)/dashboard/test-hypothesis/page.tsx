import { getSessionPatient } from "@/lib/get-patient-id";
import { generateHypothesisForConcern, regenerateHypothesisForConcern } from "../hypothesis-actions";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * DEV-ONLY test page for hypothesis generation.
 * Visit /dashboard/test-hypothesis — shows current state.
 * Click "Generate" button to trigger generation (explicit action, not on page load).
 * Delete this file after verification.
 */

async function runGeneration(formData: FormData) {
  "use server";
  const concernId = formData.get("concern_id") as string;
  if (!concernId) return;
  await generateHypothesisForConcern(concernId);
  revalidatePath("/dashboard/test-hypothesis");
}

async function runRegeneration(formData: FormData) {
  "use server";
  const concernId = formData.get("concern_id") as string;
  if (!concernId) return;
  await regenerateHypothesisForConcern(concernId);
  revalidatePath("/dashboard/test-hypothesis");
}

async function cleanupHypothesis(formData: FormData) {
  "use server";
  const hypothesisId = formData.get("hypothesis_id") as string;
  if (!hypothesisId) return;
  const { supabase } = await getSessionPatient();
  await (supabase as unknown as SupabaseClient)
    .from("hypotheses")
    .delete()
    .eq("id", hypothesisId);
  revalidatePath("/dashboard/test-hypothesis");
}

export default async function TestHypothesisPage() {
  if (process.env.NODE_ENV === "production") {
    return <p style={{ padding: 20, color: "#e6edf3" }}>Not available in production.</p>;
  }

  const { patientId, supabase } = await getSessionPatient();
  const sb = supabase as unknown as SupabaseClient;

  // Current state
  const { data: concern } = await sb
    .from("active_concerns")
    .select("id, title, key_question")
    .eq("patient_id", patientId)
    .maybeSingle();

  const { data: hypothesis } = concern
    ? await sb.from("hypotheses").select("*").eq("concern_id", concern.id).maybeSingle()
    : { data: null };

  // Core domain counts
  const [
    { count: diaryCount },
    { count: vitalsCount },
    { count: medsCount },
    { count: docsCount },
    { count: timelineCount },
    { data: medProfile },
  ] = await Promise.all([
    sb.from("diary_entries").select("id", { count: "exact", head: true }).eq("patient_id", patientId),
    sb.from("vitals").select("id", { count: "exact", head: true }).eq("patient_id", patientId),
    sb.from("medications").select("id", { count: "exact", head: true }).eq("patient_id", patientId).eq("active", true),
    sb.from("documents").select("id", { count: "exact", head: true }).eq("patient_id", patientId),
    sb.from("timeline_events").select("id", { count: "exact", head: true }).eq("patient_id", patientId),
    sb.from("medical_profile").select("blood_type, allergies, chronic_conditions").eq("patient_id", patientId).maybeSingle(),
  ]);

  const domains: string[] = [];
  if ((diaryCount ?? 0) > 0) domains.push("diary");
  if ((vitalsCount ?? 0) > 0) domains.push("vitals");
  if ((medsCount ?? 0) > 0) domains.push("medications");
  if ((docsCount ?? 0) > 0) domains.push("documents");
  if ((timelineCount ?? 0) > 0) domains.push("timeline");
  if (medProfile?.blood_type || medProfile?.allergies || medProfile?.chronic_conditions) domains.push("baseline");

  const s = { padding: 20, color: "#e6edf3", background: "#0d1117", minHeight: "100vh", fontFamily: "monospace", fontSize: 13 } as const;

  return (
    <div style={s}>
      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Hypothesis Generation — Dev Test</h2>

      <p><b>Concern:</b> {concern ? `${concern.title} (${concern.id})` : "NONE"}</p>
      <p><b>Core domains with data ({domains.length}):</b> {domains.join(", ") || "none"}</p>
      <p><b>Trigger met (concern + ≥2 domains):</b> {concern && domains.length >= 2 ? "YES" : "NO"}</p>
      <p><b>Existing hypothesis:</b> {hypothesis ? `YES (${hypothesis.id})` : "NONE"}</p>

      <hr style={{ borderColor: "#333", margin: "16px 0" }} />

      {!concern && <p style={{ color: "#f59e0b" }}>Create a concern on /dashboard first.</p>}
      {concern && domains.length < 2 && <p style={{ color: "#f59e0b" }}>Need data in ≥2 core domains. Currently: {domains.length}.</p>}

      {concern && domains.length >= 2 && !hypothesis && (
        <form action={runGeneration}>
          <input type="hidden" name="concern_id" value={concern.id} />
          <button
            type="submit"
            style={{ background: "#2dd4bf", color: "#0d1117", padding: "8px 16px", borderRadius: 6, border: "none", fontWeight: "bold", cursor: "pointer" }}
          >
            Generate Hypothesis
          </button>
          <p style={{ color: "#7d8590", fontSize: 11, marginTop: 6 }}>Calls Claude Sonnet 4.6. Uses 1 AI quota credit.</p>
        </form>
      )}

      {hypothesis && (
        <>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Hypothesis Result:</h3>

          <div style={{ background: "#161b22", padding: 12, borderRadius: 6, marginBottom: 12 }}>
            <p><b>id:</b> {hypothesis.id}</p>
            <p><b>status:</b> {hypothesis.status}</p>
            <p><b>statement:</b> {hypothesis.statement}</p>
            <p><b>created_at:</b> {hypothesis.created_at}</p>
            <p><b>updated_at:</b> {hypothesis.updated_at}</p>
          </div>

          <details style={{ marginBottom: 12 }}>
            <summary style={{ cursor: "pointer", color: "#7d8590" }}>Full JSON</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, background: "#161b22", padding: 12, borderRadius: 6, marginTop: 6 }}>
              {JSON.stringify(hypothesis, null, 2)}
            </pre>
          </details>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <form action={runRegeneration}>
              <input type="hidden" name="concern_id" value={concern!.id} />
              <button
                type="submit"
                style={{ background: "#2dd4bf", color: "#0d1117", padding: "8px 16px", borderRadius: 6, border: "none", fontWeight: "bold", cursor: "pointer" }}
              >
                Regenerate Hypothesis
              </button>
              <p style={{ color: "#7d8590", fontSize: 11, marginTop: 6 }}>
                Expected: same id, same created_at, newer updated_at.
              </p>
            </form>

            <form action={cleanupHypothesis}>
              <input type="hidden" name="hypothesis_id" value={hypothesis.id} />
              <button
                type="submit"
                style={{ background: "#f59e0b", color: "#0d1117", padding: "6px 12px", borderRadius: 6, border: "none", fontWeight: "bold", cursor: "pointer" }}
              >
                Delete Hypothesis (cleanup)
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
