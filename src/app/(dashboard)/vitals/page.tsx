import { getSessionPatient } from "@/lib/get-patient-id";
import { ModuleHelp } from "@/components/module-help";
import type { Vital } from "@/types/database";
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

export default async function VitalsPage() {
  const { patientId, supabase } = await getSessionPatient();

  const [{ data }, { data: chartData }] = await Promise.all([
    supabase
      .from("vitals")
      .select("*")
      .eq("patient_id", patientId)
      .order("measured_at", { ascending: false })
      .limit(50),
    supabase
      .from("vitals")
      .select("vital_type, value, unit, measured_at")
      .eq("patient_id", patientId)
      .order("measured_at", { ascending: false })
      .limit(500),
  ]);

  const vitals: Vital[] = data ?? [];
  const chartVitals = chartData ?? [];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Показатели</h2>
      <div className="mt-3">
        <ModuleHelp
          title="Отслеживание показателей здоровья"
          description="Записывайте давление, пульс, температуру, вес, сатурацию и уровень глюкозы."
          benefit="Графики и история измерений помогают заметить тенденции и вовремя обратить внимание на отклонения."
        />
      </div>

      <div className="mt-6">
        <VitalForm />
      </div>

      {chartVitals.length > 0 && (
        <div className="mt-8">
          <VitalsChart vitals={chartVitals} />
        </div>
      )}

      <div className="mt-8">
        {vitals.length === 0 && (
          <p className="text-sm text-gray-500">Записей пока нет</p>
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
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
          </span>
          <span className="text-lg font-medium text-gray-900">
            {vital.value}
          </span>
          <span className="text-sm text-gray-400">{vital.unit}</span>
        </div>
        <DeleteVitalButton vitalId={vital.id} />
      </div>

      <div className="mt-1 text-xs text-gray-400">
        {new Date(vital.measured_at).toLocaleString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>

      {vital.notes && (
        <p className="mt-2 text-sm text-gray-700">{vital.notes}</p>
      )}
    </div>
  );
}
