import Link from "next/link";
import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount, AI_MONTHLY_LIMIT } from "@/lib/check-ai-quota";
import { AiUsageStatus } from "@/components/ai-usage-status";
import { OnboardingModal } from "./onboarding-modal";
import type { SupabaseClient } from "@supabase/supabase-js";

const QUICK_LINKS = [
  { href: "/diary", label: "Дневник", desc: "Записать самочувствие" },
  { href: "/medications", label: "Лекарства", desc: "Отметить приём" },
  { href: "/vitals", label: "Показатели", desc: "Добавить измерение" },
  { href: "/documents", label: "Документы", desc: "Загрузить результат" },
  { href: "/ai-chat", label: "AI-чат", desc: "Задать вопрос" },
  { href: "/doctor-visit", label: "К врачу", desc: "Подготовить сводку" },
];

interface RecentItem {
  type: string;
  label: string;
  detail: string;
  date: string;
  href: string;
}

export default async function DashboardPage() {
  const { patientId, supabase } = await getSessionPatient();

  // Fetch recent data from multiple modules in parallel
  const [
    { data: profile },
    { data: diary },
    { data: vitals },
    { data: meds },
    { data: docs },
    { data: timeline },
    { data: intakes },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("patient_id", patientId).limit(1).maybeSingle(),
    supabase.from("diary_entries").select("created_at, wellbeing_score, symptoms").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3),
    supabase.from("vitals").select("vital_type, value, unit, measured_at").eq("patient_id", patientId).order("measured_at", { ascending: false }).limit(3),
    supabase.from("medications").select("name, dosage, active").eq("patient_id", patientId).eq("active", true).limit(5),
    supabase.from("documents").select("title, category, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3),
    supabase.from("timeline_events").select("title, event_type, event_date").eq("patient_id", patientId).order("event_date", { ascending: false }).limit(3),
    supabase.from("medication_intakes").select("taken_at").eq("patient_id", patientId).order("taken_at", { ascending: false }).limit(1),
  ]);

  const usageCount = await getAiUsageCount(supabase as unknown as SupabaseClient, patientId);

  // Build recent activity feed
  const recent: RecentItem[] = [];

  for (const d of diary ?? []) {
    const symptoms = d.symptoms?.length ? `: ${d.symptoms.slice(0, 3).join(", ")}` : "";
    recent.push({
      type: "Дневник",
      label: `Самочувствие ${d.wellbeing_score}/10${symptoms}`,
      detail: "",
      date: d.created_at,
      href: "/diary",
    });
  }

  for (const v of vitals ?? []) {
    const labels: Record<string, string> = {
      blood_pressure: "Давление", pulse: "Пульс", temperature: "Температура",
      spo2: "SpO2", weight: "Вес", glucose: "Глюкоза",
    };
    recent.push({
      type: "Показатель",
      label: `${labels[v.vital_type] || v.vital_type}: ${v.value} ${v.unit}`,
      detail: "",
      date: v.measured_at,
      href: "/vitals",
    });
  }

  for (const d of docs ?? []) {
    recent.push({
      type: "Документ",
      label: d.title,
      detail: d.category || "",
      date: d.created_at,
      href: "/documents",
    });
  }

  for (const t of timeline ?? []) {
    recent.push({
      type: "Событие",
      label: t.title,
      detail: "",
      date: t.event_date + "T00:00:00",
      href: "/timeline",
    });
  }

  // Sort by date descending, take top 8
  recent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const feed = recent.slice(0, 8);

  const displayName = profile?.display_name || "Пользователь";
  const activeMedCount = meds?.length ?? 0;
  const lastIntake = intakes?.[0]?.taken_at;

  return (
    <div>
      <OnboardingModal />
      <h2 className="text-2xl font-bold text-gray-900">
        Добро пожаловать, {displayName}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Ваш медицинский дневник и AI-помощник
      </p>

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl card p-4 transition hover:border-brand-400 hover:shadow-sm"
          >
            <p className="text-sm font-semibold text-brand-900">{link.label}</p>
            <p className="mt-0.5 text-xs text-gray-600">{link.desc}</p>
          </Link>
        ))}
      </div>

      {/* Onboarding hint for new users */}
      {feed.length === 0 && activeMedCount === 0 && (
        <div className="mt-6 rounded-lg border border-brand-100 bg-brand-50/60 p-4">
          <p className="text-sm font-medium text-brand-900">С чего начать?</p>
          <ul className="mt-2 space-y-1 text-sm text-brand-800">
            <li>1. Заполните <Link href="/profile" className="underline">медицинскую карточку</Link> — группа крови, аллергии, хронические заболевания</li>
            <li>2. Добавьте <Link href="/medications" className="underline">активные лекарства</Link></li>
            <li>3. Сделайте первую <Link href="/diary" className="underline">запись в дневнике</Link></li>
          </ul>
        </div>
      )}

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl card p-4 text-center">
          <p className="text-2xl font-bold text-brand-900">{activeMedCount}</p>
          <p className="mt-1 text-xs text-gray-500">
            {activeMedCount === 1 ? "активный препарат" : activeMedCount >= 2 && activeMedCount <= 4 ? "активных препарата" : "активных препаратов"}
          </p>
        </div>
        <div className="rounded-xl card p-4 text-center">
          <p className="text-2xl font-bold text-brand-900">{feed.length}</p>
          <p className="mt-1 text-xs text-gray-500">
            {feed.length === 1 ? "недавняя запись" : "недавних записей"}
          </p>
        </div>
        <div className="rounded-xl card p-4 text-center">
          <p className="text-2xl font-bold text-brand-600">
            {Math.max(0, AI_MONTHLY_LIMIT - usageCount)}
          </p>
          <p className="mt-1 text-xs text-gray-500">AI-запросов осталось</p>
        </div>
      </div>

      {/* AI usage bar */}
      <div className="mt-4">
        <AiUsageStatus used={usageCount} />
      </div>

      {/* Active medications summary */}
      {activeMedCount > 0 && (
        <div className="mt-6 rounded-xl card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Активные лекарства</h3>
            <Link href="/medications" className="text-xs text-brand-600 hover:text-brand-800">
              Все лекарства
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(meds ?? []).map((m: { name: string; dosage: string }, i: number) => (
              <span key={i} className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-800">
                {m.name} {m.dosage}
              </span>
            ))}
          </div>
          {lastIntake && (
            <p className="mt-2 text-xs text-gray-400">
              Последний приём: {new Date(lastIntake).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      )}

      {/* Recent activity feed */}
      <div className="mt-6 rounded-xl card p-4">
        <h3 className="text-sm font-semibold text-gray-900">Последние записи</h3>

        {feed.length === 0 && (
          <p className="mt-3 text-sm text-gray-400">
            Пока нет записей. Начните с дневника или добавьте измерение.
          </p>
        )}

        {feed.length > 0 && (
          <div className="mt-3 space-y-2">
            {feed.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="flex items-center justify-between rounded px-2 py-1.5 transition hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 rounded bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                    {item.type}
                  </span>
                  <span className="truncate text-sm text-gray-800">{item.label}</span>
                  {item.detail && (
                    <span className="shrink-0 text-xs text-gray-400">{item.detail}</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-gray-400">
                  {new Date(item.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
