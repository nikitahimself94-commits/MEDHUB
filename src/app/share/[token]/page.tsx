import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";

export default async function SharePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createServiceClient();

  // Validate token
  const { data: link } = await supabase
    .from("doctor_share_links")
    .select("patient_id, status, expires_at")
    .eq("token", params.token)
    .single();

  if (!link) return notFound();

  if (link.status !== "active") {
    return (
      <Page>
        <div className="rounded p-6 text-center" style={{ border: "1px solid rgba(245,158,11,0.15)", backgroundColor: "rgba(245,158,11,0.1)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--amber)" }}>Ссылка отозвана</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--amber)" }}>
            Пациент отозвал доступ к этой сводке.
          </p>
        </div>
      </Page>
    );
  }

  if (new Date(link.expires_at) < new Date()) {
    return (
      <Page>
        <div className="rounded p-6 text-center" style={{ border: "1px solid rgba(245,158,11,0.15)", backgroundColor: "rgba(245,158,11,0.1)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--amber)" }}>Ссылка истекла</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--amber)" }}>
            Срок действия ссылки истёк. Попросите пациента создать новую.
          </p>
        </div>
      </Page>
    );
  }

  const patientId = link.patient_id;

  // Fetch safe summary data
  const [
    { data: profile },
    { data: medProfile },
    { data: meds },
    { data: vitals },
    { data: visitPrep },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("patient_id", patientId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("medical_profiles")
      .select("blood_type, rh_factor, allergies, chronic_conditions, emergency_info")
      .eq("patient_id", patientId)
      .maybeSingle(),
    supabase
      .from("medications")
      .select("name, dosage, schedule")
      .eq("patient_id", patientId)
      .eq("active", true)
      .limit(20),
    supabase
      .from("vitals")
      .select("vital_type, value, unit, measured_at")
      .eq("patient_id", patientId)
      .order("measured_at", { ascending: false })
      .limit(10),
    supabase
      .from("doctor_visit_preps")
      .select("summary, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const displayName = profile?.display_name || "Пациент";
  const activeMeds = meds ?? [];
  const recentVitals = vitals ?? [];
  const prep = visitPrep?.[0] ?? null;

  const vitalLabels: Record<string, string> = {
    blood_pressure: "Давление",
    pulse: "Пульс",
    temperature: "Температура",
    spo2: "SpO2",
    weight: "Вес",
    glucose: "Глюкоза",
  };

  return (
    <Page>
      <div className="rounded p-6" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{displayName}</h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Медицинская сводка MedHUB</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Данные на {new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
          </div>
          <span className="rounded px-3 py-1 text-xs font-medium" style={{ backgroundColor: "var(--accent-muted)", color: "var(--accent)" }}>
            Только для просмотра
          </span>
        </div>

        {/* Medical profile */}
        {medProfile && (
          <div className="mt-4 rounded p-3" style={{ backgroundColor: "var(--bg-surface-hover)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Медкарта</p>
            <div className="mt-2 space-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
              {medProfile.blood_type && (
                <p>Группа крови: {medProfile.blood_type}{medProfile.rh_factor || ""}</p>
              )}
              {medProfile.chronic_conditions?.length > 0 && (
                <p>Хронические заболевания: {medProfile.chronic_conditions.join(", ")}</p>
              )}
              {medProfile.allergies?.length > 0 && (
                <p>Аллергии: {medProfile.allergies.map((a: { name: string }) => a.name).join(", ")}</p>
              )}
              {medProfile.emergency_info && (
                <p>Экстренная информация: {medProfile.emergency_info}</p>
              )}
            </div>
          </div>
        )}

        {/* Active medications */}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Активные лекарства ({activeMeds.length})
          </p>
          {activeMeds.length === 0 && (
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Нет активных препаратов</p>
          )}
          {activeMeds.length > 0 && (
            <div className="mt-2 space-y-1">
              {activeMeds.map((m: { name: string; dosage: string; schedule: string }, i: number) => (
                <div key={i} className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{m.name}</span>
                  <span style={{ color: "var(--text-muted)" }}>{m.dosage}</span>
                  {m.schedule && <span style={{ color: "var(--text-muted)" }}>({m.schedule})</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent vitals */}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Последние показатели
          </p>
          {recentVitals.length === 0 && (
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Нет данных</p>
          )}
          {recentVitals.length > 0 && (
            <div className="mt-2 space-y-1">
              {recentVitals.map((v: { vital_type: string; value: string; unit: string; measured_at: string }, i: number) => (
                <div key={i} className="flex items-baseline justify-between text-sm">
                  <span style={{ color: "var(--text-muted)" }}>
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{vitalLabels[v.vital_type] || v.vital_type}:</span>{" "}
                    {v.value} {v.unit}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(v.measured_at).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI visit prep */}
        {prep && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                AI-сводка для визита
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {new Date(prep.created_at).toLocaleDateString("ru-RU")}
              </p>
            </div>
            <div className="mt-2 whitespace-pre-wrap text-sm" style={{ color: "var(--text-muted)" }}>
              {prep.summary}
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>
        Эта страница создана пациентом в MedHUB для передачи данных врачу.
        Ссылка действительна до {new Date(link.expires_at).toLocaleDateString("ru-RU")}.
      </p>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-8" style={{ background: "var(--bg-primary)" }}>
      <div className="mx-auto max-w-2xl">
        <h1
          className="mb-6 text-center text-lg font-bold tracking-[0.15em]"
          style={{ color: "var(--accent)" }}
        >
          MEDHUB
        </h1>
        {children}
      </div>
    </div>
  );
}
