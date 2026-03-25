import Link from "next/link";
import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount } from "@/lib/check-ai-quota";
import { getLocalDayStart } from "@/lib/local-day";
import { getOrRefreshMco } from "@/lib/mco";
import { ServerRotation, type RotationState } from "@/lib/template-rotation";
import { paraphraseHeroOpening } from "@/lib/haiku-paraphrase";
import { AiUsageStatus } from "@/components/ai-usage-status";
import { OnboardingGate } from "./onboarding-gate";
import { FirstArrivalOverlay } from "./first-arrival-overlay";
import { InlineAi } from "./inline-ai";
import { AiSummary } from "./ai-summary";
import { heroOpening, heroObservation, heroNextStep, heroEvidence, heroDataState } from "./hero-from-mco";
import { moduleStatuses } from "./module-statuses";

import type { SupabaseClient } from "@supabase/supabase-js";


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
    supabase.from("profiles").select("display_name, onboarding_context, onboarding_completed_at").eq("patient_id", patientId).limit(1).maybeSingle(),
    supabase.from("diary_entries").select("created_at, wellbeing_score, symptoms").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3),
    supabase.from("vitals").select("vital_type, value, unit, measured_at").eq("patient_id", patientId).order("measured_at", { ascending: false }).limit(5),
    supabase.from("medications").select("name, dosage, active").eq("patient_id", patientId).eq("active", true).limit(10),
    supabase.from("documents").select("title, category, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3),
    supabase.from("timeline_events").select("title, event_type, event_date").eq("patient_id", patientId).order("event_date", { ascending: false }).limit(3),
    supabase.from("medication_intakes").select("taken_at").eq("patient_id", patientId).order("taken_at", { ascending: false }).limit(1),
    supabase.from("doctor_visit_preps").select("summary, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1),
  ]);

  // Rotation state: separate fail-safe query (column may not exist if migration 00027 not applied)
  let rotationState: RotationState | null = null;
  {
    const { data: rotProfile } = await supabase
      .from("profiles")
      .select("companion_rotation_state")
      .eq("patient_id", patientId)
      .limit(1)
      .maybeSingle();
    if (rotProfile) {
      rotationState = rotProfile.companion_rotation_state as RotationState | null;
    }
  }

  const usageCount = await getAiUsageCount(supabase as unknown as SupabaseClient, patientId);

  const displayName = profile?.display_name?.trim() || "";
  const onboardingCtx = (profile?.onboarding_context as Record<string, string>) ?? null;
  const onboardingCompletedAt = (profile?.onboarding_completed_at as string) ?? null;

  // Gate logic: show fullscreen welcome flow ONLY for truly new users
  // Skip if: explicitly completed, OR has onboarding context, OR has any real product data
  const hasProductData = (diary ?? []).length > 0
    || (vitals ?? []).length > 0
    || (docs ?? []).length > 0
    || (meds ?? []).length > 0;
  const onboardingDone = !!onboardingCompletedAt
    || (!!onboardingCtx && Object.keys(onboardingCtx).length > 0)
    || hasProductData;

  if (!onboardingDone) {
    return <OnboardingGate />;
  }

  // First arrival: onboarding completed but no product data yet
  const isFirstArrival = !!onboardingCompletedAt && !hasProductData;

  // MCO v1: build or use cached Medical Context Object
  const mco = await getOrRefreshMco(supabase as unknown as SupabaseClient, patientId);

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

  // --- Hero from MCO + per-user rotation ---
  const rotation = new ServerRotation(rotationState);
  const dataState = heroDataState(mco);
  const baseOpening = heroOpening(mco, displayName, rotation);
  const paraphrased = await paraphraseHeroOpening(baseOpening, mco.greeting_context, mco.time_of_day);
  const agentOpening = paraphrased ?? baseOpening;
  const agentObservation = heroObservation(mco);
  const agentNextStep = heroNextStep(mco);
  const evidence = heroEvidence(mco);

  // Persist rotation state if changed
  if (rotation.isDirty()) {
    const { error: rotErr } = await supabase
      .from("profiles")
      .update({ companion_rotation_state: rotation.getState() })
      .eq("patient_id", patientId);
    if (rotErr) {
      console.error("[Rotation] Failed to persist:", rotErr.message);
    }
  }

  // --- Module micro-statuses from MCO ---
  const modules = moduleStatuses(mco);

  // --- "Что важно сегодня" signals ---
  // Signals complement the hero CTA — skip items already covered by priority_action
  interface TodaySignal {
    text: string;
    sub?: string;
    href: string;
    tone: "action" | "ok" | "hint";
  }
  const signals: TodaySignal[] = [];
  const todayStart = getLocalDayStart();
  const heroCoversDiary = mco.priority_action === "add_diary" || mco.priority_action === "update_diary";
  const heroCoversVitals = mco.priority_action === "add_vitals";

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

  // 2. Diary: today entry? (skip if hero CTA already directs to diary)
  if (!heroCoversDiary) {
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
  }

  // 3. Vitals: stale check (>3 days) (skip if hero CTA already directs to vitals)
  if (!heroCoversVitals) {
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
      {/* First arrival overlay — shows once after onboarding, with delay */}
      <FirstArrivalOverlay show={isFirstArrival} />

      {/* ===== PROACTIVE AGENT HERO ===== */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#1A2F2B" }}
      >
        {/* Opening + Observation — dark ground, text pops */}
        <div className="px-6 pt-6 pb-5">
          <p className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "#5A8F85" }}>
            Ваш помощник
          </p>
          <p className="mt-2 text-[19px] font-bold leading-snug text-white">
            {agentOpening}
          </p>
          <p className="mt-2.5 text-[15px] leading-relaxed" style={{ color: "#B0CDC8" }}>
            {agentObservation}
          </p>
        </div>

        {/* Next step — accent strip */}
        <Link
          href={agentNextStep.href}
          className="flex items-center gap-3 px-6 py-4 transition hover:brightness-110 active:scale-[0.995]"
          style={{ backgroundColor: "#2D6E6A" }}
        >
          <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}>
            →
          </span>
          <div className="min-w-0">
            <span className="text-[15px] font-semibold text-white">{agentNextStep.text}</span>
            {agentNextStep.sub && (
              <span className="block text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>{agentNextStep.sub}</span>
            )}
          </div>
        </Link>

        {/* Evidence — inline footer */}
        {evidence.length > 0 && (
          <div className="px-6 py-2.5 flex flex-wrap gap-x-3 gap-y-0.5" style={{ backgroundColor: "#162623" }}>
            {evidence.map((e) => (
              <Link
                key={e.label}
                href={e.href}
                className="text-[11px] transition hover:underline"
                style={{ color: "#5A8F85" }}
              >
                {e.label} · {e.detail}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* AI-generated health summary — only for rich state */}
      {dataState === "rich" && (
        <div className="mt-4">
          <AiSummary patientId={patientId} />
        </div>
      )}

      {/* Что важно сегодня — lighter to not compete */}
      <div className="mt-4 rounded-2xl card p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8AA8A2" }}>Что важно сегодня</h3>
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

      {/* Module micro-statuses — agent-directed navigation */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {modules.map((m) => (
          <Link
            key={m.key}
            href={m.href}
            className="flex flex-col gap-0.5 rounded-xl px-3.5 py-3 transition hover:brightness-95 active:scale-[0.98]"
            style={{
              backgroundColor: m.isPrimary ? "rgba(45,110,106,0.08)" : "rgba(138,168,162,0.06)",
            }}
          >
            <span
              className="text-[13px] font-semibold"
              style={{ color: m.isPrimary ? "#1A2F2B" : "#3D6B62" }}
            >
              {m.label}
            </span>
            <span
              className="text-[11px] leading-snug"
              style={{ color: m.isPrimary ? "#2D6E6A" : "#8AA8A2" }}
            >
              {m.status}
            </span>
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
