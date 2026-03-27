import { getSessionPatient } from "@/lib/get-patient-id";
import type { EmotionEntry } from "@/types/database";
import { EmotionForm } from "./emotion-form";
import { DeleteEmotionButton } from "./delete-emotion-button";
import { emotionsStateBlock } from "./emotions-companion";

const PARAM_LABELS: Record<string, string> = {
  anxiety: "Тревога",
  depression: "Подавленность",
  calmness: "Спокойствие",
  fatigue: "Усталость",
  hope: "Надежда",
};

export default async function EmotionsPage() {
  const { patientId, supabase } = await getSessionPatient();

  const { data } = await supabase
    .from("emotion_entries")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(50);

  const entries: EmotionEntry[] = data ?? [];

  const state = emotionsStateBlock(entries.length);

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Эмоции</h2>

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
        <EmotionForm entryCount={entries.length} />
      </div>

      {entries.length > 0 && (
        <div className="mt-8 space-y-3">
          {entries.map((entry) => (
            <EmotionCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmotionCard({ entry }: { entry: EmotionEntry }) {
  const params = [
    { key: "anxiety" as const, val: entry.anxiety },
    { key: "depression" as const, val: entry.depression },
    { key: "calmness" as const, val: entry.calmness },
    { key: "fatigue" as const, val: entry.fatigue },
    { key: "hope" as const, val: entry.hope },
  ];

  const formattedDate = new Date(entry.created_at).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="rounded-xl card p-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-wrap gap-3">
          {params.map((p) => (
            <span key={p.key} className="text-sm" style={{ color: "var(--text-muted)" }}>
              <span className="font-medium" style={{ color: "var(--text-muted)" }}>{PARAM_LABELS[p.key]}:</span>{" "}
              {p.val}/5
            </span>
          ))}
        </div>
        <DeleteEmotionButton entryId={entry.id} />
      </div>

      <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{formattedDate}</div>

      {entry.notes && (
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{entry.notes}</p>
      )}
    </div>
  );
}
