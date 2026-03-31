import Link from "next/link";
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

export default async function SymptomsMapPage({
  searchParams,
}: {
  searchParams: { _state?: string };
}) {
  const { patientId, supabase } = await getSessionPatient();

  // Dev preview mode
  const previewState = process.env.NODE_ENV !== "production" ? searchParams._state : undefined;

  const days30 = getDaysList(30);
  const days14 = getDaysList(14);

  let entries: { created_at: string; symptoms: string[] }[];
  let data14: Record<string, string[]>;
  let data30: Record<string, string[]>;

  if (previewState === "empty") {
    entries = [];
    data14 = {};
    data30 = {};
  } else if (previewState === "early") {
    // Synthetic early state: 2 diary entries, 2 symptoms
    const now = new Date();
    entries = [
      { created_at: new Date(now.getTime() - 2 * 86400000).toISOString(), symptoms: ["головная боль"] },
      { created_at: new Date(now.getTime() - 5 * 86400000).toISOString(), symptoms: ["головная боль", "усталость"] },
    ];
    data14 = buildMatrix(entries, days14);
    data30 = buildMatrix(entries, days30);
  } else {
    const { data } = await supabase
      .from("diary_entries")
      .select("created_at, symptoms, structured_symptoms")
      .eq("patient_id", patientId)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    entries = (data ?? []).map((row) => {
      const structured = Array.isArray(row.structured_symptoms)
        ? (row.structured_symptoms as { name?: string }[]).map((s) => (s.name ?? "").trim()).filter(Boolean)
        : [];
      const deduped = Array.from(new Set(structured.length > 0 ? structured : (row.symptoms as string[] ?? [])));
      return { created_at: row.created_at as string, symptoms: deduped };
    });

    data14 = buildMatrix(entries, days14);
    data30 = buildMatrix(entries, days30);
  }

  const state = symptomsStateBlock({
    diaryEntriesLast30: entries.length,
    uniqueSymptoms14: Object.keys(data14).length,
    uniqueSymptoms30: Object.keys(data30).length,
  });

  const isEmpty = entries.length === 0;
  const hasSymptoms = Object.keys(data30).length > 0;

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Карта симптомов</h2>

      {/* Module-level agent framing */}
      <div className="mt-3 rounded-xl px-4 py-3.5" style={{ backgroundColor: "rgba(45,212,191,0.03)", border: "1px solid rgba(45,212,191,0.08)" }}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)", opacity: hasSymptoms ? 0.7 : 0.4 }} />
          <div>
            <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
              {state.line}
            </p>
            {state.supporting && (
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {state.supporting}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Empty state — guided start */}
      {isEmpty && (
        <div className="mt-6 rounded-xl px-5 py-5 text-center" style={{ border: "1px dashed rgba(255,255,255,0.08)" }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "var(--text-muted)", opacity: 0.35 }}>
            Как это работает
          </p>
          <p className="text-[12px] leading-[1.6] max-w-sm mx-auto" style={{ color: "var(--text-muted)" }}>
            Симптомы появляются здесь автоматически из записей дневника. Я строю карту: какие симптомы, когда и как часто — чтобы видеть паттерны.
          </p>
          <Link
            href="/diary"
            className="inline-block mt-4 rounded-lg px-5 py-2.5 text-[12px] font-bold transition-all hover:brightness-110"
            style={{ backgroundColor: "var(--accent)", color: "var(--bg-primary)" }}
          >
            Добавить запись в дневник
          </Link>
        </div>
      )}

      {/* Early state — few symptoms, map not yet useful */}
      {!isEmpty && hasSymptoms && Object.keys(data30).length <= 2 && (
        <div className="mt-4 rounded-lg px-4 py-3" style={{ borderLeft: "3px solid rgba(45,212,191,0.15)" }}>
          <p className="text-[11px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>
            Я уже вижу первые сигналы — {Object.keys(data30).length === 1 ? "один симптом" : `${Object.keys(data30).length} симптома`} за 30 дней. Пока рано искать паттерны, но продолжай фиксировать — через 3–5 записей карта станет полезной.
          </p>
          <Link
            href="/diary"
            className="inline-block mt-2 text-[11px] font-medium transition-opacity hover:opacity-75"
            style={{ color: "var(--accent)" }}
          >
            Добавить запись →
          </Link>
        </div>
      )}

      {/* Symptoms matrix */}
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
