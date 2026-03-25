import { getSessionPatient } from "@/lib/get-patient-id";
import { ModuleHelp } from "@/components/module-help";
import { DiaryEntryForm } from "./diary-entry-form";
import { DeleteDiaryButton } from "./delete-diary-button";

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

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Дневник самочувствия</h2>
      <div className="mt-3">
        <ModuleHelp
          title="Ежедневный дневник здоровья"
          description="Записывайте своё самочувствие, симптомы, уровень боли и качество сна каждый день."
          benefit="Регулярные записи позволяют отслеживать динамику состояния и замечать закономерности, которые сложно уловить по памяти."
        />
      </div>

      <div className="mt-6">
        <DiaryEntryForm entryCount={diaryEntries.length} />
      </div>

      <div className="mt-8 space-y-4">
        {diaryEntries.length === 0 && (
          <p className="text-sm text-gray-500">Записей пока нет</p>
        )}

        {diaryEntries.map((entry) => (
          <div key={entry.id} className="rounded-xl card p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-gray-900">
                Самочувствие: {entry.wellbeing_score}/10
              </span>
              <span className="text-xs text-gray-400">
                {new Date(entry.created_at).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
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
                    className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {entry.notes && (
              <p className="mt-2 text-sm text-gray-700">{entry.notes}</p>
            )}

            {entry.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.tags.map((t, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs text-brand-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-2 border-t border-gray-100 pt-2">
              <DeleteDiaryButton id={entry.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
