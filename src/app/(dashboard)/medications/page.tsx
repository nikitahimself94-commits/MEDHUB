import { getSessionPatient } from "@/lib/get-patient-id";
import { getLocalDayStart } from "@/lib/local-day";
import type { Medication } from "@/types/database";
import { MedicationForm } from "./medication-form";
import { IntakeButton } from "./intake-button";
import { ToggleActiveButton } from "./toggle-active-button";
import { UndoIntakeButton } from "./undo-intake-button";
import { RecentIntakes } from "./recent-intakes";
import { EditMedicationForm } from "./edit-medication-form";
import { DeleteMedicationButton } from "./delete-medication-button";
import { medicationsStateBlock } from "./medications-companion";

interface RecentIntake {
  taken_at: string;
  display_name: string;
}

export default async function MedicationsPage() {
  const { patientId, supabase } = await getSessionPatient();

  const { data: meds } = await supabase
    .from("medications")
    .select("*")
    .eq("patient_id", patientId)
    .order("active", { ascending: false })
    .order("created_at", { ascending: false });

  const medications: Medication[] = meds ?? [];

  const [{ data: profiles }, { data: allIntakes }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name")
      .eq("patient_id", patientId),
    supabase
      .from("medication_intakes")
      .select("medication_id, created_by, taken_at")
      .eq("patient_id", patientId)
      .order("taken_at", { ascending: false })
      .limit(200),
  ]);

  const nameMap: Record<string, string> = {};
  for (const p of profiles ?? []) {
    nameMap[p.user_id] = p.display_name;
  }

  const todayStart = getLocalDayStart();

  const intakeCounts: Record<string, number> = {};
  const recentIntakes: Record<string, RecentIntake[]> = {};

  for (const row of allIntakes ?? []) {
    // Today count
    if (new Date(row.taken_at) >= todayStart) {
      intakeCounts[row.medication_id] =
        (intakeCounts[row.medication_id] || 0) + 1;
    }

    // Recent 3 per medication
    const list = (recentIntakes[row.medication_id] ??= []);
    if (list.length < 3) {
      list.push({
        taken_at: row.taken_at,
        display_name: row.created_by
          ? nameMap[row.created_by] ?? "Пользователь"
          : "Пользователь",
      });
    }
  }

  const activeMeds = medications.filter((m) => m.active);
  const inactiveMeds = medications.filter((m) => !m.active);

  // Count how many active meds have at least 1 intake today
  const takenTodayCount = activeMeds.filter((m) => (intakeCounts[m.id] || 0) > 0).length;
  const state = medicationsStateBlock({
    activeCount: activeMeds.length,
    inactiveCount: inactiveMeds.length,
    takenTodayCount,
  });

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("ru-RU");
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Лекарства</h2>

      {/* Agent state block */}
      <div
        className="mt-3 rounded-2xl px-5 py-4"
        style={{ backgroundColor: "rgba(45,110,106,0.05)" }}
      >
        <p className="text-[14px] font-medium leading-snug" style={{ color: "#1A2F2B" }}>
          {state.line}
        </p>
        {state.supporting && (
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "#5A8F85" }}>
            {state.supporting}
          </p>
        )}
      </div>

      <div className="mt-6">
        <MedicationForm medCount={medications.length} />
      </div>

      <div className="mt-8">

        {activeMeds.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Активные ({activeMeds.length})
            </h3>
            <div className="space-y-3">
              {activeMeds.map((med) => (
                <MedicationCard
                  key={med.id}
                  med={med}
                  formatDate={formatDate}
                  todayCount={intakeCounts[med.id] || 0}
                  recentIntakes={recentIntakes[med.id] ?? []}
                />
              ))}
            </div>
          </div>
        )}

        {inactiveMeds.length > 0 && (
          <div className={activeMeds.length > 0 ? "mt-8" : ""}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Неактивные ({inactiveMeds.length})
            </h3>
            <div className="space-y-3">
              {inactiveMeds.map((med) => (
                <MedicationCard
                  key={med.id}
                  med={med}
                  formatDate={formatDate}
                  recentIntakes={recentIntakes[med.id] ?? []}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MedicationCard({
  med,
  formatDate,
  todayCount,
  recentIntakes,
}: {
  med: Medication;
  formatDate: (d: string) => string;
  todayCount?: number;
  recentIntakes: RecentIntake[];
}) {
  const takenToday = (todayCount ?? 0) > 0;

  return (
    <div
      className={`rounded-xl card p-4 ${
        !med.active ? "border-gray-200 opacity-60" : takenToday ? "border-teal-200" : "border-amber-200"
      }`}
    >
      {/* Row 1: Name + dosage + status badge + today badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm sm:text-base font-semibold text-gray-900">{med.name}</span>
          {med.dosage && (
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {med.dosage}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {med.active && todayCount !== undefined && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                takenToday
                  ? "bg-teal-50 text-teal-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {takenToday ? `Принят (${todayCount})` : "Не принят"}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              med.active
                ? "bg-teal-50 text-teal-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {med.active ? "Активный" : "Неактивный"}
          </span>
        </div>
      </div>

      {/* Row 2: Schedule + dates */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
        {med.schedule && (
          <span>{med.schedule}</span>
        )}
        <span className="text-xs text-gray-400">
          {formatDate(med.start_date)}
          {med.end_date ? ` — ${formatDate(med.end_date)}` : " — наст. время"}
        </span>
      </div>

      {med.notes && (
        <p className="mt-2 text-sm text-gray-500">{med.notes}</p>
      )}

      {/* Row 3: Actions for active meds */}
      {med.active && todayCount !== undefined && (
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
          <IntakeButton medicationId={med.id} />
          <UndoIntakeButton
            medicationId={med.id}
            hasIntakes={recentIntakes.length > 0}
          />
        </div>
      )}

      {med.active && <RecentIntakes intakes={recentIntakes} />}

      <div className="mt-2 flex items-center gap-3">
        <ToggleActiveButton medicationId={med.id} active={med.active} />
        <EditMedicationForm med={med} />
        <DeleteMedicationButton medicationId={med.id} />
      </div>
    </div>
  );
}
