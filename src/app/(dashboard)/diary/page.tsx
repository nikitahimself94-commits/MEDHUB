import { getSessionPatient } from "@/lib/get-patient-id";
import { getCompanionContext } from "../_shared/get-companion-context";
import { CompanionContext } from "@/components/companion-context";
import { DiaryEntryForm } from "./diary-entry-form";
import { DeleteDiaryButton } from "./delete-diary-button";
import type { SupabaseClient } from "@supabase/supabase-js";

interface DiaryEntry {
  id: string;
  created_at: string;
  created_by: string | null;
  wellbeing_score: number;
  symptoms: string[];
  pain_location: string | null;
  pain_score: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  notes: string | null;
  tags: string[];
}

export default async function DiaryPage() {
  const { patientId, supabase } = await getSessionPatient();

  const { data: entries } = await supabase
    .from("diary_entries")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  const diaryEntries: DiaryEntry[] = entries ?? [];

  const companion = await getCompanionContext(supabase as unknown as SupabaseClient, patientId, "/diary");

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Дневник самочувствия</h2>
      {/* Agent framing */}
      <div className="mt-3 rounded-xl px-4 py-3.5" style={{ backgroundColor: "rgba(45,212,191,0.03)", border: "1px solid rgba(45,212,191,0.08)" }}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)", opacity: diaryEntries.length > 0 ? 0.7 : 0.4 }} />
          <div>
            <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
              {diaryEntries.length === 0
                ? "Мне нужны записи, чтобы начать отслеживать динамику."
                : diaryEntries.length <= 3
                  ? `Уже ${diaryEntries.length} ${diaryEntries.length === 1 ? "запись" : diaryEntries.length <= 4 ? "записи" : "записей"}. Чем регулярнее фиксируешь — тем точнее я вижу паттерны.`
                  : "Записи помогают мне находить связи между самочувствием, симптомами и внешними факторами."}
            </p>
          </div>
        </div>
      </div>
      {companion && (
        <div className="mt-2">
          <CompanionContext concernTitle={companion.concernTitle} reason={companion.reason} missingSignal={companion.missingSignal} />
        </div>
      )}

      <div className="mt-6">
        <DiaryEntryForm entryCount={diaryEntries.length} />
      </div>

      <div className="mt-8 space-y-4">
        {diaryEntries.length === 0 && (
          <div className="rounded-lg px-4 py-4 text-center" style={{ border: "1px dashed rgba(255,255,255,0.08)" }}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Записей пока нет. Добавь первую — агент начнёт отслеживать динамику.
            </p>
          </div>
        )}

        {diaryEntries.map((entry) => (
          <div key={entry.id} className="rounded-xl card p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Самочувствие: {entry.wellbeing_score}/10
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {new Date(entry.created_at).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {entry.pain_score != null && (
                <span>
                  Боль: {entry.pain_score}/10
                  {entry.pain_location && ` (${entry.pain_location})`}
                </span>
              )}
              {entry.sleep_hours != null && (
                <span>
                  Сон: {entry.sleep_hours}ч
                  {entry.sleep_quality != null && `, качество ${entry.sleep_quality}/5`}
                </span>
              )}
            </div>

            {entry.symptoms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.symptoms.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full px-2.5 py-0.5 text-xs"
                    style={{ backgroundColor: "rgba(245,158,11,0.1)", color: "var(--amber)" }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {entry.notes && (
              <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{entry.notes}</p>
            )}

            {entry.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.tags.map((t, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-accent-muted px-2.5 py-0.5 text-xs text-accent"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>
              <DeleteDiaryButton id={entry.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
