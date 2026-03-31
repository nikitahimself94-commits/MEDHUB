import { getSessionPatient } from "@/lib/get-patient-id";
import { getLocalDayStart } from "@/lib/local-day";
import { getCompanionContext } from "../_shared/get-companion-context";
import { CompanionContext } from "@/components/companion-context";
import type { Medication } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
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

  const companion = await getCompanionContext(supabase as unknown as SupabaseClient, patientId, "/medications");

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Лекарства</h2>
      {companion && (
        <div className="mt-3">
          <CompanionContext concernTitle={companion.concernTitle} reason={companion.reason} missingSignal={companion.missingSignal} />
        </div>
      )}

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
        <MedicationForm medCount={medications.length} />
      </div>

      <div className="mt-8">

        {activeMeds.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
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
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
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
        !med.active ? "opacity-60" : ""
      }`}
      style={{
        borderColor: !med.active
          ? "var(--border)"
          : takenToday
            ? "rgba(45,212,191,0.2)"
            : "rgba(245,158,11,0.15)",
      }}
    >
      {/* Row 1: Name + dosage + status badge + today badge */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate text-sm sm:text-base font-semibold" style={{ color: "var(--text-primary)" }}>{med.name}</span>
          {med.dosage && (
            <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "var(--bg-surface-hover)", color: "var(--text-muted)" }}>
              {med.dosage}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {med.active && todayCount !== undefined && (
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={
                takenToday
                  ? { backgroundColor: "var(--accent-muted)", color: "var(--accent)" }
                  : { backgroundColor: "rgba(245,158,11,0.1)", color: "var(--amber)" }
              }
            >
              {takenToday ? `Принят (${todayCount})` : "Не принят"}
            </span>
          )}
          <span
            className="rounded-full px-2 py-0.5 text-xs"
            style={
              med.active
                ? { backgroundColor: "var(--accent-muted)", color: "var(--accent)" }
                : { backgroundColor: "var(--bg-surface-hover)", color: "var(--text-muted)" }
            }
          >
            {med.active ? "Активный" : "Неактивный"}
          </span>
        </div>
      </div>

      {/* Row 2: Schedule + dates */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
        {med.schedule && (
          <span>{med.schedule}</span>
        )}
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {formatDate(med.start_date)}
          {med.end_date ? ` — ${formatDate(med.end_date)}` : " — наст. время"}
        </span>
      </div>

      {med.notes && (
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{med.notes}</p>
      )}

      {/* Row 3: Actions for active meds */}
      {med.active && todayCount !== undefined && (
        <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
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
