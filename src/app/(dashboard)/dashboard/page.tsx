import Link from "next/link";
import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { getLocalDayStart } from "@/lib/local-day";
import { AiUsageStatus } from "@/components/ai-usage-status";
import { OnboardingModal } from "./onboarding-modal";
import { InlineAi } from "./inline-ai";
import { AiSummary } from "./ai-summary";
import { DataFreshness } from "./data-freshness";
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

  // Fetch onboarding context separately — column may not exist yet (migration pending)
  let onboardingCtx: Record<string, string> | null = null;
  try {
    const { data: obProfile } = await supabase
      .from("profiles")
      .select("onboarding_context")
      .eq("patient_id", patientId)
      .limit(1)
      .maybeSingle();
    onboardingCtx = (obProfile?.onboarding_context as Record<string, string>) ?? null;
  } catch {
    // Column doesn't exist yet — graceful fallback
  }
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

  // --- Smart next step ---
  const hasDiary = (diary ?? []).length > 0;
  const hasVitals = (vitals ?? []).length > 0;
  const hasPrep = !!lastPrep;

  let nextStep: { text: string; sub: string; href: string } | null = null;

  if (!hasDiary) {
    nextStep = {
      text: "Запишите самочувствие",
      sub: "Одна запись в дневнике — и агент сможет отслеживать динамику",
      href: "/diary",
    };
  } else if (!hasVitals) {
    nextStep = {
      text: "Добавьте первый показатель",
      sub: "Давление, пульс или вес — это усилит аналитику",
      href: "/vitals",
    };
  } else if (!hasPrep) {
    nextStep = {
      text: "Подготовьте сводку для врача",
      sub: "Данных уже достаточно — AI соберёт структурированный отчёт",
      href: "/doctor-visit",
    };
  }

  // --- "Что важно сегодня" signals ---
  interface TodaySignal {
    text: string;
    sub?: string;
    href: string;
    tone: "action" | "ok" | "hint";
  }
  const signals: TodaySignal[] = [];
  const todayStart = getLocalDayStart();

  // 1. Medications: intake status
  if (activeMeds.length > 0) {
    const intakeToday = lastIntake && new Date(lastIntake) >= todayStart;
    if (intakeToday) {
      signals.push({
        text: "Приём лекарств зафиксирован",
        href: "/medications",
        tone: "ok",
      });
    } else {
      signals.push({
        text: "Отметить приём лекарств",
        sub: `${activeMeds.length} активных препаратов`,
        href: "/medications",
        tone: "action",
      });
    }
  }

  // 2. Diary: today entry?
  const diaryToday = diary?.[0] && new Date(diary[0].created_at) >= todayStart;
  if (!diaryToday) {
    signals.push({
      text: "Записать самочувствие",
      sub: diary?.[0]
        ? `Последняя запись: ${new Date(diary[0].created_at).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}`
        : undefined,
      href: "/diary",
      tone: "action",
    });
  }

  // 3. Vitals: stale check (>3 days)
  const lastVitalDate = vitals?.[0]?.measured_at ? new Date(vitals[0].measured_at) : null;
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  if (!lastVitalDate || lastVitalDate < threeDaysAgo) {
    signals.push({
      text: "Добавить показатель",
      sub: lastVitalDate
        ? `Последний: ${lastVitalDate.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}`
        : "Ещё нет измерений",
      href: "/vitals",
      tone: "hint",
    });
  }

  // 4. Fresh visit prep
  if (lastPrep) {
    const prepAge = Date.now() - new Date(lastPrep.created_at).getTime();
    if (prepAge < 7 * 24 * 60 * 60 * 1000) {
      signals.push({
        text: "Сводка для врача готова",
        sub: "Можно открыть или поделиться",
        href: "/doctor-visit",
        tone: "ok",
      });
    }
  }

  // 5. Low-data fallback: suggest any first action
  if (signals.length === 0) {
    signals.push({
      text: "Добавьте первые данные",
      sub: "Дневник, показатели или документ — и я начну работать с вашей ситуацией",
      href: "/diary",
      tone: "action",
    });
  }

  // Cap at 4 signals
  const todaySignals = signals.slice(0, 4);

  return (
    <div>
      <OnboardingModal />

      {/* Hero: AI-first greeting */}
      <div className="rounded-2xl card p-6">
        <p className="text-lg font-bold" style={{ color: "#1A2F2B" }}>
          {hasData ? `${displayName}, вот ваша сводка` : `${displayName}, я ваш медицинский помощник`}
        </p>
        <p className="mt-1 text-sm" style={{ color: "#5A8F85" }}>
          {hasData
            ? "На основе ваших данных — состояние, лекарства, последние записи"
            : onboardingCtx?.reason
              ? `Вы рассказали: ${onboardingCtx.reason}. Начните добавлять данные — и я смогу помогать предметнее.`
              : "Я уже знакомлюсь с вами. Начните с любого шага — данные, дневник или вопрос в чате."}
        </p>

        {/* AI status summary - brief snapshot with source links */}
        {hasData && (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm" style={{ color: "#3D6B62" }}>
            {diary?.[0] && (
              <Link href="/diary" className="transition hover:underline">
                Самочувствие: <strong>{diary[0].wellbeing_score}/10</strong>
              </Link>
            )}
            {activeMeds.length > 0 && (
              <Link href="/medications" className="transition hover:underline">
                Препаратов: <strong>{activeMeds.length}</strong>
              </Link>
            )}
            {vitals?.[0] && (
              <Link href="/vitals" className="transition hover:underline">
                {vitalLabels[vitals[0].vital_type]}: <strong>{vitals[0].value} {vitals[0].unit}</strong>
              </Link>
            )}
          </div>
        )}

        {!hasData && (
          <div className="mt-5 rounded-xl p-5" style={{ backgroundColor: "rgba(45,110,106,0.05)" }}>
            <p className="text-[15px] leading-relaxed" style={{ color: "#2D5A54" }}>
              Знакомство уже началось. Чем больше данных вы добавите — тем точнее я смогу помогать. Но торопиться не нужно: начните с того, что удобно.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Link href="/diary" className="rounded-xl px-4 py-3 text-sm font-semibold text-center transition hover:shadow-md" style={{ backgroundColor: "rgba(45,110,106,0.1)", color: "#2D6E6A" }}>
                Записать самочувствие
              </Link>
              <Link href="/vitals" className="rounded-xl px-4 py-3 text-sm font-semibold text-center transition hover:shadow-md" style={{ backgroundColor: "rgba(45,110,106,0.1)", color: "#2D6E6A" }}>
                Добавить показатель
              </Link>
              <Link href="/documents" className="rounded-xl px-4 py-3 text-sm font-semibold text-center transition hover:shadow-md" style={{ backgroundColor: "rgba(45,110,106,0.1)", color: "#2D6E6A" }}>
                Загрузить документ
              </Link>
            </div>
            <Link
              href="/ai-chat"
              className="mt-3 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:shadow-md"
              style={{ backgroundColor: "#2D6E6A" }}
            >
              Задать вопрос AI-помощнику
            </Link>
          </div>
        )}
      </div>

      {/* AI-generated health summary */}
      {hasData && (
        <div className="mt-4">
          <AiSummary patientId={patientId} />
        </div>
      )}

      {/* Data freshness / coverage */}
      <div className="mt-4">
        <DataFreshness
          layers={[
            { label: "Дневник", href: "/diary", lastDate: diary?.[0]?.created_at ?? null },
            { label: "Показатели", href: "/vitals", lastDate: vitals?.[0]?.measured_at ?? null },
            { label: "Лекарства", href: "/medications", lastDate: lastIntake ?? null },
            { label: "Документы", href: "/documents", lastDate: docs?.[0]?.created_at ?? null },
          ]}
        />
      </div>

      {/* Smart next step */}
      {nextStep && (
        <Link
          href={nextStep.href}
          className="mt-4 flex items-center gap-4 rounded-2xl card p-5 transition hover:shadow-md active:scale-[0.99]"
        >
          <span
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full text-white text-sm font-bold"
            style={{ backgroundColor: "#2D6E6A" }}
          >
            →
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "#1A2F2B" }}>
              {nextStep.text}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "#5A8F85" }}>
              {nextStep.sub}
            </p>
          </div>
        </Link>
      )}

      {/* Что важно сегодня */}
      <div className="mt-4 rounded-2xl card p-5">
        <h3 className="text-sm font-bold" style={{ color: "#1A2F2B" }}>Что важно сегодня</h3>
        <div className="mt-3 space-y-2">
          {todaySignals.map((s, i) => (
            <Link
              key={i}
              href={s.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/50"
              style={{ backgroundColor: s.tone === "action" ? "rgba(45,110,106,0.05)" : "transparent" }}
            >
              <span
                className="shrink-0 h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    s.tone === "action" ? "#2D6E6A"
                    : s.tone === "ok" ? "#8AA8A2"
                    : "#BFC8C5",
                }}
              />
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm"
                  style={{
                    color: s.tone === "action" ? "#1A2F2B" : "#5A8F85",
                    fontWeight: s.tone === "action" ? 600 : 400,
                  }}
                >
                  {s.text}
                </p>
                {s.sub && (
                  <p className="mt-0.5 text-xs" style={{ color: "#8AA8A2" }}>{s.sub}</p>
                )}
              </div>
              <span
                className="shrink-0 text-xs font-medium"
                style={{ color: s.tone === "action" ? "#2D6E6A" : "#BFC8C5" }}
              >→</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-xl card px-2 py-3 text-center text-[13px] leading-snug font-semibold transition hover:shadow-md"
            style={{ color: "#2D6E6A" }}
          >
            {a.label}
          </Link>
        ))}
      </div>

      {/* Inline AI */}
      <div className="mt-4">
        <InlineAi />
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
            <h3 className="text-sm font-bold" style={{ color: "#1A2F2B" }}>Сводка для врача</h3>
            <span className="text-xs" style={{ color: "#8AA8A2" }}>
              {new Date(lastPrep.created_at).toLocaleDateString("ru-RU")}
            </span>
          </div>
          <p className="mt-2 text-sm line-clamp-3" style={{ color: "#3D6B62" }}>
            {lastPrep.summary.slice(0, 200)}...
          </p>
          <div className="mt-3 flex flex-wrap gap-3 pt-2 border-t" style={{ borderColor: "rgba(45,110,106,0.1)" }}>
            <Link href="/doctor-visit" className="text-xs font-medium" style={{ color: "#2D6E6A" }}>
              Открыть полностью →
            </Link>
            <Link href="/doctor-visit" className="text-xs font-medium" style={{ color: "#5A8F85" }}>
              Передать врачу →
            </Link>
          </div>
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
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{ backgroundColor: "rgba(45,110,106,0.08)", color: "#2D6E6A" }}
                  >
                    {item.type}
                  </span>
                  <span className="truncate text-sm" style={{ color: "#1A2F2B" }}>{item.label}</span>
                </div>
                <span className="shrink-0 ml-1 text-xs" style={{ color: "#8AA8A2" }}>
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
