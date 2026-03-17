import Link from "next/link";
import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { AiUsageStatus } from "@/components/ai-usage-status";
import { OnboardingModal } from "./onboarding-modal";
import type { SupabaseClient } from "@supabase/supabase-js";

const QUICK_ACTIONS = [
  { href: "/diary", label: "Записать самочувствие" },
  { href: "/medications", label: "Отметить приём" },
  { href: "/vitals", label: "Добавить измерение" },
  { href: "/ai-chat", label: "Спросить AI" },
];

interface RecentItem {
  type: string;
  label: string;
  date: string;
  href: string;
}

export default async function DashboardPage() {
  const { patientId, supabase } = await getSessionPatient();

  const [
    { data: profile },
    { data: diary },
    { data: vitals },
    { data: meds },
    { data: docs },
    { data: timeline },
    { data: intakes },
    { data: visitPrep },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("patient_id", patientId).limit(1).maybeSingle(),
    supabase.from("diary_entries").select("created_at, wellbeing_score, symptoms").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3),
    supabase.from("vitals").select("vital_type, value, unit, measured_at").eq("patient_id", patientId).order("measured_at", { ascending: false }).limit(5),
    supabase.from("medications").select("name, dosage, active").eq("patient_id", patientId).eq("active", true).limit(10),
    supabase.from("documents").select("title, category, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3),
    supabase.from("timeline_events").select("title, event_type, event_date").eq("patient_id", patientId).order("event_date", { ascending: false }).limit(3),
    supabase.from("medication_intakes").select("taken_at").eq("patient_id", patientId).order("taken_at", { ascending: false }).limit(1),
    supabase.from("doctor_visit_preps").select("summary, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1),
  ]);

  const usageCount = await getAiUsageCount(supabase as unknown as SupabaseClient, patientId);

  const displayName = profile?.display_name || "Пользователь";
  const activeMeds = meds ?? [];
  const lastIntake = intakes?.[0]?.taken_at;
  const lastPrep = visitPrep?.[0] ?? null;

  // Build activity feed
  const recent: RecentItem[] = [];
  const vitalLabels: Record<string, string> = {
    blood_pressure: "Давление", pulse: "Пульс", temperature: "Температура",
    spo2: "SpO2", weight: "Вес", glucose: "Глюкоза",
  };

  for (const d of diary ?? []) {
    const symptoms = d.symptoms?.length ? `: ${d.symptoms.slice(0, 2).join(", ")}` : "";
    recent.push({ type: "Дневник", label: `${d.wellbeing_score}/10${symptoms}`, date: d.created_at, href: "/diary" });
  }
  for (const v of vitals ?? []) {
    recent.push({ type: "Показатель", label: `${vitalLabels[v.vital_type] || v.vital_type}: ${v.value} ${v.unit}`, date: v.measured_at, href: "/vitals" });
  }
  for (const d of docs ?? []) {
    recent.push({ type: "Документ", label: d.title, date: d.created_at, href: "/documents" });
  }
  for (const t of timeline ?? []) {
    recent.push({ type: "Событие", label: t.title, date: t.event_date + "T00:00:00", href: "/timeline" });
  }
  recent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const feed = recent.slice(0, 6);

  const hasData = feed.length > 0 || activeMeds.length > 0;

  return (
    <div>
      <OnboardingModal />

      {/* Hero: AI-first greeting */}
      <div className="rounded-2xl card p-6">
        <p className="text-lg font-bold" style={{ color: "#1A2F2B" }}>
          {displayName}, вот ваша сводка
        </p>
        <p className="mt-1 text-sm" style={{ color: "#5A8F85" }}>
          AI анализирует ваши данные и помогает разобраться в состоянии здоровья
        </p>

        {/* AI status summary - brief snapshot */}
        {hasData && (
          <div className="mt-4 flex flex-wrap gap-4 text-sm" style={{ color: "#3D6B62" }}>
            {diary?.[0] && (
              <span>Самочувствие: <strong>{diary[0].wellbeing_score}/10</strong></span>
            )}
            {activeMeds.length > 0 && (
              <span>Препаратов: <strong>{activeMeds.length}</strong></span>
            )}
            {vitals?.[0] && (
              <span>{vitalLabels[vitals[0].vital_type]}: <strong>{vitals[0].value} {vitals[0].unit}</strong></span>
            )}
          </div>
        )}

        {!hasData && (
          <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: "rgba(45,110,106,0.05)" }}>
            <p className="text-sm font-medium" style={{ color: "#2D6E6A" }}>С чего начать?</p>
            <ol className="mt-2 space-y-1 text-sm" style={{ color: "#3D6B62" }}>
              <li>1. <Link href="/profile" className="underline font-medium">Заполните карточку</Link> — группа крови, аллергии</li>
              <li>2. <Link href="/medications" className="underline font-medium">Добавьте лекарства</Link> — текущие препараты</li>
              <li>3. <Link href="/diary" className="underline font-medium">Запишите самочувствие</Link> — первая запись в дневнике</li>
            </ol>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-xl card p-3 text-center text-[13px] font-semibold transition hover:shadow-md"
            style={{ color: "#2D6E6A" }}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {/* Active medications with intake action */}
      {activeMeds.length > 0 && (
        <div className="mt-4 rounded-2xl card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: "#1A2F2B" }}>Текущие лекарства</h3>
            <Link href="/medications" className="text-xs font-medium" style={{ color: "#2D6E6A" }}>
              Управление →
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeMeds.map((m: { name: string; dosage: string }, i: number) => (
              <span key={i} className="rounded-full px-3 py-1.5 text-sm font-medium" style={{ backgroundColor: "rgba(45,110,106,0.08)", color: "#2D6E6A" }}>
                {m.name} {m.dosage}
              </span>
            ))}
          </div>
          {lastIntake && (
            <p className="mt-2 text-xs" style={{ color: "#8AA8A2" }}>
              Последний приём: {new Date(lastIntake).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      )}

      {/* Last visit prep preview */}
      {lastPrep && (
        <div className="mt-4 rounded-2xl card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold" style={{ color: "#1A2F2B" }}>Последняя сводка для врача</h3>
            <Link href="/doctor-visit" className="text-xs font-medium" style={{ color: "#2D6E6A" }}>
              Подробнее →
            </Link>
          </div>
          <p className="mt-2 text-sm line-clamp-3" style={{ color: "#3D6B62" }}>
            {lastPrep.summary.slice(0, 200)}...
          </p>
          <p className="mt-1 text-xs" style={{ color: "#8AA8A2" }}>
            {new Date(lastPrep.created_at).toLocaleDateString("ru-RU")}
          </p>
        </div>
      )}

      {/* Recent activity */}
      {feed.length > 0 && (
        <div className="mt-4 rounded-2xl card p-5">
          <h3 className="text-sm font-bold" style={{ color: "#1A2F2B" }}>Последние записи</h3>
          <div className="mt-3 space-y-2">
            {feed.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-white/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{ backgroundColor: "rgba(45,110,106,0.08)", color: "#2D6E6A" }}
                  >
                    {item.type}
                  </span>
                  <span className="truncate text-sm" style={{ color: "#1A2F2B" }}>{item.label}</span>
                </div>
                <span className="shrink-0 text-xs" style={{ color: "#8AA8A2" }}>
                  {new Date(item.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* AI usage footer */}
      <div className="mt-4">
        <AiUsageStatus used={usageCount} />
      </div>
    </div>
  );
}
