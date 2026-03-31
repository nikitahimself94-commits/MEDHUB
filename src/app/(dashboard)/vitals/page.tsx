import { getSessionPatient } from "@/lib/get-patient-id";
import { getCompanionContext } from "../_shared/get-companion-context";
import { CompanionContext } from "@/components/companion-context";
import type { Vital } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VitalForm } from "./vital-form";
import { DeleteVitalButton } from "./delete-vital-button";
import { VitalsChart } from "./vitals-chart";

const VITAL_LABELS: Record<string, string> = {
  blood_pressure: "Давление",
  pulse: "Пульс",
  temperature: "Температура",
  spo2: "SpO2",
  weight: "Вес",
  glucose: "Глюкоза",
};

export default async function VitalsPage({
  searchParams,
}: {
  searchParams: { _state?: string };
}) {
  const { patientId, supabase } = await getSessionPatient();

  const previewState = process.env.NODE_ENV !== "production" ? searchParams._state : undefined;

  let vitals: Vital[];
  let chartVitals: { vital_type: string; value: string; unit: string; measured_at: string }[];

  if (previewState === "empty") {
    vitals = [];
    chartVitals = [];
  } else if (previewState === "early") {
    const now = new Date();
    const synth: Vital[] = [
      { id: "preview-1", patient_id: patientId, created_by: null, vital_type: "blood_pressure" as Vital["vital_type"], value: "138/88", unit: "mmHg", measured_at: new Date(now.getTime() - 1 * 86400000).toISOString(), notes: null, created_at: new Date(now.getTime() - 1 * 86400000).toISOString(), concern_id: null },
      { id: "preview-2", patient_id: patientId, created_by: null, vital_type: "pulse" as Vital["vital_type"], value: "78", unit: "уд/мин", measured_at: new Date(now.getTime() - 2 * 86400000).toISOString(), notes: null, created_at: new Date(now.getTime() - 2 * 86400000).toISOString(), concern_id: null },
    ];
    vitals = synth;
    chartVitals = synth.map(v => ({ vital_type: v.vital_type, value: v.value, unit: v.unit, measured_at: v.measured_at }));
  } else {
    const [{ data }, { data: cData }] = await Promise.all([
      supabase.from("vitals").select("*").eq("patient_id", patientId).order("measured_at", { ascending: false }).limit(50),
      supabase.from("vitals").select("vital_type, value, unit, measured_at").eq("patient_id", patientId).order("measured_at", { ascending: false }).limit(500),
    ]);
    vitals = data ?? [];
    chartVitals = cData ?? [];
  }

  const companion = await getCompanionContext(supabase as unknown as SupabaseClient, patientId, "/vitals");

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Показатели</h2>
      {/* Agent framing */}
      <div className="mt-3 rounded-xl px-4 py-3.5" style={{ backgroundColor: "rgba(45,212,191,0.03)", border: "1px solid rgba(45,212,191,0.08)" }}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)", opacity: vitals.length > 0 ? 0.7 : 0.4 }} />
          <div>
            <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--text-primary)" }}>
              {vitals.length === 0
                ? "Мне нужны объективные измерения — они усиливают анализ фактами, а не ощущениями."
                : vitals.length <= 3
                  ? `Уже ${vitals.length} ${vitals.length === 1 ? "измерение" : "измерения"}. Для анализа тенденций нужна регулярность — хотя бы 3–5 измерений одного типа.`
                  : "Показатели помогают мне подтверждать или опровергать гипотезы объективными данными."}
            </p>
            {vitals.length === 0 && (
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Самые ценные для старта: давление, пульс, температура.
              </p>
            )}
          </div>
        </div>
      </div>
      {companion && (
        <div className="mt-2">
          <CompanionContext concernTitle={companion.concernTitle} reason={companion.reason} missingSignal={companion.missingSignal} />
        </div>
      )}

      <div className="mt-6">
        <VitalForm entryCount={vitals.length} />
      </div>

      {chartVitals.length > 0 && (
        <div className="mt-8">
          <VitalsChart vitals={chartVitals} />
        </div>
      )}

      <div className="mt-8">
        {vitals.length === 0 && (
          <div className="rounded-lg px-4 py-4 text-center" style={{ border: "1px dashed rgba(255,255,255,0.08)" }}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Измерений пока нет. Добавь первое — давление или пульс для начала.
            </p>
          </div>
        )}
        {vitals.length > 0 && vitals.length <= 2 && (
          <div className="mb-3 rounded-lg px-4 py-2.5" style={{ borderLeft: "3px solid rgba(45,212,191,0.15)" }}>
            <p className="text-[11px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>
              Первые измерения уже у меня. Для анализа тенденций нужна серия — повтори тот же тип показателя через 1–2 дня.
            </p>
          </div>
        )}

        {vitals.length > 0 && (
          <div className="space-y-3">
            {vitals.map((v) => (
              <VitalCard key={v.id} vital={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VitalCard({ vital }: { vital: Vital }) {
  const label = VITAL_LABELS[vital.vital_type] ?? vital.vital_type;

  return (
    <div className="rounded-xl card p-4">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            {label}
          </span>
          <span className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            {vital.value}
          </span>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>{vital.unit}</span>
        </div>
        <DeleteVitalButton vitalId={vital.id} />
      </div>

      <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {new Date(vital.measured_at).toLocaleString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      {vital.notes && (
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{vital.notes}</p>
      )}
    </div>
  );
}
