import Link from "next/link";
import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { getLocalDayStart } from "@/lib/local-day";
import { AiUsageStatus } from "@/components/ai-usage-status";
import { OnboardingModal } from "./onboarding-modal";
import { InlineAi } from "./inline-ai";
import { AiSummary } from "./ai-summary";

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
  {
    const { data: obProfile, error: obErr } = await supabase
      .from("profiles")
      .select("onboarding_context")
      .eq("patient_id", patientId)
      .limit(1)
      .maybeSingle();
    if (!obErr) {
      onboardingCtx = (obProfile?.onboarding_context as Record<string, string>) ?? null;
    }
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

  const hasDiary = (diary ?? []).length > 0;
  const hasVitals = (vitals ?? []).length > 0;
  const hasDocs = (docs ?? []).length > 0;
  const hasPrep = !!lastPrep;
  const dataLayers = [hasDiary, hasVitals, hasDocs, activeMeds.length > 0].filter(Boolean).length;
  const dataState: "empty" | "partial" | "rich" = dataLayers === 0 ? "empty" : dataLayers <= 2 ? "partial" : "rich";

  // --- Agent observation (1 main insight) ---
  let agentOpening = "";
  let agentObservation = "";
  let agentNextStep: { text: string; href: string } = { text: "", href: "" };

  if (dataState === "empty") {
    agentOpening = `${displayName}, я готов начать работать с вами.`;
    if (onboardingCtx?.reason) {
      agentObservation = `Вы рассказали: ${onboardingCtx.reason}. Мне нужна первая опора — любые данные о вашем состоянии, чтобы начать разбираться.`;
    } else if (onboardingCtx?.current_concern) {
      agentObservation = `Вы упомянули: ${onboardingCtx.current_concern}. Запишите самочувствие или загрузите документ — и я смогу начать работать с этим.`;
    } else {
      agentObservation = "У меня пока нет данных о вашем состоянии. Дайте мне первую опору — дневник, показатель или документ — и я начну собирать картину.";
    }
    agentNextStep = { text: "Записать самочувствие", href: "/diary" };
  } else if (dataState === "partial") {
    agentOpening = `${displayName}, я посмотрел ваши данные.`;
    // Build observation from what we have
    const parts: string[] = [];
    if (diary?.[0]) {
      const score = diary[0].wellbeing_score;
      const scoreWord = score >= 7 ? "стабильное" : score >= 4 ? "среднее" : "ниже обычного";
      parts.push(`последнее самочувствие ${scoreWord} (${score}/10)`);
    }
    if (vitals?.[0]) {
      parts.push(`${vitalLabels[vitals[0].vital_type] || vitals[0].vital_type}: ${vitals[0].value} ${vitals[0].unit}`);
    }
    if (activeMeds.length > 0) {
      parts.push(`${activeMeds.length} активных препаратов`);
    }
    const seen = parts.length > 0 ? `Я вижу: ${parts.join(", ")}.` : "";
    const missing: string[] = [];
    if (!hasDiary) missing.push("дневника");
    if (!hasVitals) missing.push("показателей");
    if (!hasDocs) missing.push("документов");
    const gap = missing.length > 0 ? ` Картина пока неполная — не хватает ${missing.join(" и ")}.` : "";
    agentObservation = seen + gap;
    // Next step: fill the biggest gap
    if (!hasDiary) agentNextStep = { text: "Записать самочувствие", href: "/diary" };
    else if (!hasVitals) agentNextStep = { text: "Добавить показатель", href: "/vitals" };
    else if (!hasDocs) agentNextStep = { text: "Загрузить документ", href: "/documents" };
    else agentNextStep = { text: "Подготовить сводку для врача", href: "/doctor-visit" };
  } else {
    // rich
    agentOpening = `${displayName}, вот что сейчас выглядит главным.`;
    // Derive main insight
    if (diary?.[0]) {
      const score = diary[0].wellbeing_score;
      const symptoms = diary[0].symptoms?.length ? diary[0].symptoms.slice(0, 2).join(", ") : null;
      if (score <= 4) {
        agentObservation = `Самочувствие ${score}/10${symptoms ? ` (${symptoms})` : ""} — это ниже обычного. Стоит отслеживать динамику ближайшие дни.`;
      } else if (symptoms) {
        agentObservation = `Самочувствие ${score}/10, но есть ${symptoms}. По остальным данным картина стабильная.`;
      } else {
        agentObservation = `Самочувствие ${score}/10, данные поступают регулярно. Картина стабильная.`;
      }
    } else {
      agentObservation = "Данные поступают из нескольких источников. Картина складывается.";
    }
    // Next step for rich state
    if (!hasPrep) {
      agentNextStep = { text: "Подготовить сводку для врача", href: "/doctor-visit" };
    } else {
      const diaryToday = diary?.[0] && new Date(diary[0].created_at) >= getLocalDayStart();
      if (!diaryToday) {
        agentNextStep = { text: "Записать сегодняшнее самочувствие", href: "/diary" };
      } else {
        agentNextStep = { text: "Задать вопрос по данным", href: "/ai-chat" };
      }
    }
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

  // --- Evidence items for the hero ---
  interface EvidenceItem { label: string; detail: string; href: string }
  const evidence: EvidenceItem[] = [];
  if (diary?.[0]) {
    const daysAgo = Math.floor((Date.now() - new Date(diary[0].created_at).getTime()) / 86400000);
    evidence.push({
      label: "Дневник",
      detail: daysAgo === 0 ? "сегодня" : daysAgo === 1 ? "вчера" : `${daysAgo} дн. назад`,
      href: "/diary",
    });
  }
  if (vitals?.[0]) {
    evidence.push({
      label: vitalLabels[vitals[0].vital_type] || "Показатель",
      detail: `${vitals[0].value} ${vitals[0].unit}`,
      href: "/vitals",
    });
  }
  if (activeMeds.length > 0) {
    evidence.push({ label: "Лекарства", detail: `${activeMeds.length} активных`, href: "/medications" });
  }
  if (docs?.[0]) {
    evidence.push({ label: "Документы", detail: `${(docs ?? []).length} загружено`, href: "/documents" });
  }
  if (onboardingCtx && Object.keys(onboardingCtx).length > 0 && evidence.length === 0) {
    evidence.push({ label: "Знакомство", detail: "контекст сохранён", href: "/ai-chat" });
  }

  return (
    <div>
      <OnboardingModal />

      {/* ===== PROACTIVE AGENT HERO ===== */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: "#F4F8F7", border: "1px solid rgba(45,110,106,0.1)" }}>
        {/* A. Agent opening */}
        <p className="text-lg font-bold leading-snug" style={{ color: "#1A2F2B" }}>
          {agentOpening}
        </p>

        {/* B. Main observation */}
        <p className="mt-2.5 text-[15px] leading-relaxed" style={{ color: "#2D5A54" }}>
          {agentObservation}
        </p>

        {/* C. One next step */}
        <Link
          href={agentNextStep.href}
          className="mt-5 flex items-center gap-3 rounded-xl px-4 py-3.5 transition hover:shadow-md active:scale-[0.99]"
          style={{ backgroundColor: "#2D6E6A" }}
        >
          <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }}>
            →
          </span>
          <span className="text-sm font-semibold text-white">
            {agentNextStep.text}
          </span>
        </Link>

        {/* D. Evidence block */}
        {evidence.length > 0 && (
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(45,110,106,0.1)" }}>
            <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "#8AA8A2" }}>
              На чём основано
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
              {evidence.map((e) => (
                <Link
                  key={e.label}
                  href={e.href}
                  className="inline-flex items-center gap-1.5 text-xs transition hover:underline"
                  style={{ color: "#3D6B62" }}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#2D6E6A" }} />
                  <span className="font-medium">{e.label}</span>
                  <span style={{ color: "#8AA8A2" }}>{e.detail}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI-generated health summary — only for rich state */}
      {dataState === "rich" && (
        <div className="mt-4">
          <AiSummary patientId={patientId} />
        </div>
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

      {/* Quick actions — secondary, muted */}
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 px-2">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="text-xs font-medium transition hover:underline py-1"
            style={{ color: "#8AA8A2" }}
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
