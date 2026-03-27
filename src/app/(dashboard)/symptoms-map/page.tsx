import { getSessionPatient } from "@/lib/get-patient-id";
import { SymptomsMatrix } from "./symptoms-matrix";
import { symptomsStateBlock } from "./symptoms-companion";

function getDaysList(daysBack: number): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

function buildMatrix(
  entries: { created_at: string; symptoms: string[] }[],
  days: string[]
): Record<string, string[]> {
  const daySet = new Set(days);
  const map: Record<string, Set<string>> = {};

  for (const entry of entries) {
    const day = new Date(entry.created_at).toISOString().slice(0, 10);
    if (!daySet.has(day)) continue;
    for (const symptom of entry.symptoms) {
      if (!map[symptom]) map[symptom] = new Set();
      map[symptom].add(day);
    }
  }

  const result: Record<string, string[]> = {};
  for (const [symptom, set] of Object.entries(map)) {
    result[symptom] = Array.from(set);
  }
  return result;
}

export default async function SymptomsMapPage() {
  const { patientId, supabase } = await getSessionPatient();

  const days30 = getDaysList(30);
  const days14 = getDaysList(14);

  const { data } = await supabase
    .from("diary_entries")
    .select("created_at, symptoms")
    .eq("patient_id", patientId)
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  const entries = data ?? [];

  const data14 = buildMatrix(entries, days14);
  const data30 = buildMatrix(entries, days30);

  const state = symptomsStateBlock({
    diaryEntriesLast30: entries.length,
    uniqueSymptoms14: Object.keys(data14).length,
    uniqueSymptoms30: Object.keys(data30).length,
  });

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Карта симптомов</h2>

      {/* Agent state block */}
      <div
        className="mt-3 rounded-2xl px-5 py-4"
        style={{ backgroundColor: "var(--accent-muted)" }}
      >
        <p className="text-[14px] font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
          {state.line}
        </p>
        {state.supporting && (
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {state.supporting}
          </p>
        )}
      </div>

      <div className="mt-6">
        {entries.length > 0 && (
          <SymptomsMatrix
            data14={data14}
            data30={data30}
            days14={days14}
            days30={days30}
          />
        )}
      </div>
    </div>
  );
}
