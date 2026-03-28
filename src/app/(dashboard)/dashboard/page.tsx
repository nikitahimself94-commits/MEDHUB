import Link from "next/link";
import { getSessionPatient } from "@/lib/get-patient-id";
import { getOrRefreshMco } from "@/lib/mco";
import { ServerRotation, type RotationState } from "@/lib/template-rotation";
import { paraphraseHeroOpening } from "@/lib/haiku-paraphrase";
import { OnboardingGate } from "./onboarding-gate";
import { FirstArrivalOverlay } from "./first-arrival-overlay";
import { ReviewReset } from "./review-reset";
import { heroOpening, heroObservation, heroNextStep, heroUnlockMessage, heroMapHelper } from "./hero-from-mco";
import { moduleStatuses } from "./module-statuses";

import type { SupabaseClient } from "@supabase/supabase-js";


export default async function DashboardPage() {
  const { patientId, supabase } = await getSessionPatient();

  const [
    { data: profile },
    { data: diary },
    { data: vitals },
    { data: meds },
    { data: docs },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, onboarding_context, onboarding_completed_at").eq("patient_id", patientId).limit(1).maybeSingle(),
    supabase.from("diary_entries").select("created_at, wellbeing_score, symptoms").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3),
    supabase.from("vitals").select("vital_type, value, unit, measured_at").eq("patient_id", patientId).order("measured_at", { ascending: false }).limit(5),
    supabase.from("medications").select("name, dosage, active").eq("patient_id", patientId).eq("active", true).limit(10),
    supabase.from("documents").select("title, category, created_at").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3),
  ]);

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

  const displayName = profile?.display_name?.trim() || "";
  const onboardingCtx = (profile?.onboarding_context as Record<string, string>) ?? null;
  const onboardingCompletedAt = (profile?.onboarding_completed_at as string) ?? null;

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

  const isFirstArrival = onboardingDone && !hasProductData;

  const mco = await getOrRefreshMco(supabase as unknown as SupabaseClient, patientId);

  const rotation = new ServerRotation(rotationState);
  const baseOpening = heroOpening(mco, displayName, rotation);
  const paraphrased = await paraphraseHeroOpening(baseOpening, mco.greeting_context, mco.time_of_day);
  const agentOpening = paraphrased ?? baseOpening;
  const agentObservation = heroObservation(mco);
  const agentNextStep = heroNextStep(mco);
  const unlockMessage = heroUnlockMessage(mco);
  const mapHelper = heroMapHelper(mco);
  if (rotation.isDirty()) {
    const { error: rotErr } = await supabase
      .from("profiles")
      .update({ companion_rotation_state: rotation.getState() })
      .eq("patient_id", patientId);
    if (rotErr) {
      console.error("[Rotation] Failed to persist:", rotErr.message);
    }
  }

  const modules = moduleStatuses(mco);

  // --- Node data ---
  const c = mco.data_completeness;
  const pri = mco.priority_action;

  interface MapNode {
    key: string;
    label: string;
    href: string;
    status: string;
    detail: string | null;
    state: "empty" | "active" | "stale" | "attention";
    icon: string;
  }

  const diaryLen = (diary ?? []).length;
  const vitalsLen = (vitals ?? []).length;
  const medsLen = (meds ?? []).length;
  const docsLen = (docs ?? []).length;

  function plural(n: number, one: string, few: string, many: string): string {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs >= 11 && abs <= 19) return many;
    if (last === 1) return one;
    if (last >= 2 && last <= 4) return few;
    return many;
  }

  function nodeState(score: number, isPriority: boolean, isStale: boolean): MapNode["state"] {
    if (isPriority) return "attention";
    if (isStale) return "stale";
    if (score > 0) return "active";
    return "empty";
  }

  const modByKey = Object.fromEntries(modules.map((m) => [m.key, m]));

  const nodes: MapNode[] = [
    {
      key: "wellbeing", label: "Самочувствие", href: "/diary",
      status: modByKey.diary?.status ?? "нет записей",
      detail: diaryLen > 0 ? `${diaryLen} ${plural(diaryLen, "запись", "записи", "записей")}` : null,
      state: nodeState(Math.max(c.diary, c.emotions), pri === "add_diary" || pri === "update_diary" || pri === "add_emotions", !!modByKey.diary?.stale),
      icon: "♡",
    },
    {
      key: "vitals", label: "Показатели", href: "/vitals",
      status: modByKey.vitals?.status ?? "нет данных",
      detail: vitalsLen > 0 ? `${vitalsLen} ${plural(vitalsLen, "значение", "значения", "значений")}` : null,
      state: nodeState(c.vitals, pri === "add_vitals", !!modByKey.vitals?.stale),
      icon: "〜",
    },
    {
      key: "documents", label: "Документы", href: "/documents",
      status: modByKey.documents?.status ?? "нет загрузок",
      detail: docsLen > 0 ? `${docsLen} ${plural(docsLen, "файл", "файла", "файлов")}` : null,
      state: nodeState(c.documents, pri === "upload_document", false),
      icon: "▤",
    },
    {
      key: "medications", label: "Лекарства", href: "/medications",
      status: modByKey.medications?.status ?? "нет данных",
      detail: medsLen > 0 ? `${medsLen} ${plural(medsLen, "активное", "активных", "активных")}` : null,
      state: nodeState(c.medications, pri === "add_medications", false),
      icon: "⊕",
    },
    {
      key: "lifestyle", label: "Образ жизни", href: "/timeline",
      status: modByKey.lifestyle?.status ?? "нет активности",
      detail: null,
      state: nodeState(c.diary > 0 || c.vitals > 0 ? 1 : 0, false, !!modByKey.lifestyle?.stale),
      icon: "↻",
    },
  ];

  const stateStyles: Record<MapNode["state"], { bg: string; border: string; glow: string; iconColor: string; textColor: string; statusColor: string }> = {
    empty: {
      bg: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      glow: "none",
      iconColor: "rgba(255,255,255,0.35)",
      textColor: "rgba(255,255,255,0.55)",
      statusColor: "rgba(255,255,255,0.40)",
    },
    active: {
      bg: "rgba(45,212,191,0.06)",
      border: "1px solid rgba(45,212,191,0.25)",
      glow: "0 0 30px rgba(45,212,191,0.10)",
      iconColor: "var(--accent)",
      textColor: "var(--text-primary)",
      statusColor: "var(--accent)",
    },
    stale: {
      bg: "rgba(251,191,36,0.05)",
      border: "1px solid rgba(251,191,36,0.18)",
      glow: "0 0 24px rgba(251,191,36,0.06)",
      iconColor: "rgba(251,191,36,0.7)",
      textColor: "var(--text-primary)",
      statusColor: "rgba(251,191,36,0.7)",
    },
    attention: {
      bg: "rgba(245,158,11,0.06)",
      border: "1px solid rgba(245,158,11,0.30)",
      glow: "0 0 36px rgba(245,158,11,0.12)",
      iconColor: "var(--amber)",
      textColor: "var(--text-primary)",
      statusColor: "var(--amber)",
    },
  };

  const hub = nodes.find((n) => n.key === "wellbeing")!;
  const hubS = stateStyles[hub.state];
  const symptomsNode = modules.find((m) => m.key === "symptoms");
  const satellites = nodes.filter((n) => n.key !== "wellbeing" && n.key !== "lifestyle");
  const bridge = nodes.find((n) => n.key === "lifestyle")!;
  const bridgeS = stateStyles[bridge.state];

  // Latest diary entry for state panel
  const lastDiary = (diary ?? [])[0] as { created_at: string; wellbeing_score: number; symptoms: string[] } | undefined;
  const lastVital = (vitals ?? [])[0] as { vital_type: string; value: string; unit: string } | undefined;

  return (
    <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
      {process.env.NODE_ENV !== "production" && <ReviewReset />}
      <FirstArrivalOverlay show={isFirstArrival} />

      <div className="px-4 sm:px-5 pt-5 sm:pt-6 pb-5 sm:pb-6 space-y-3">

        {/* ===== ROW 1: Agent greeting — single line feel ===== */}
        <div>
          <p className="text-[18px] sm:text-[22px] font-bold leading-[1.2]" style={{ color: "var(--text-primary)" }}>
            {agentOpening}
          </p>
          <p className="mt-1 text-[13px] leading-[1.45]" style={{ color: "var(--text-muted)" }}>
            {agentObservation}
          </p>
          {unlockMessage && (
            <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--accent)" }}>{unlockMessage}</p>
          )}
        </div>

        {/* ===== ROW 2: Two-column dashboard body ===== */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">

          {/* LEFT: Central state panel — 3 cols on sm+ */}
          <div className="sm:col-span-3 space-y-2">
            {/* State panel */}
            <Link
              href={hub.href}
              className="block rounded-2xl p-4 transition-all hover:brightness-110"
              style={{ backgroundColor: hubS.bg, border: hubS.border }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl" style={{ color: hubS.iconColor }}>{hub.icon}</span>
                  <span className="text-[15px] font-bold" style={{ color: hubS.textColor }}>{hub.label}</span>
                </div>
                <span className="text-[11px] font-medium" style={{ color: hubS.statusColor, opacity: hub.state === "empty" ? 0.5 : 0.9 }}>
                  {hub.status}
                </span>
              </div>

              {/* Key signals inside state panel */}
              <div className="mt-3 space-y-1.5">
                {lastDiary && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <span style={{ color: "var(--accent)", opacity: 0.6 }}>●</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      Самочувствие {lastDiary.wellbeing_score}/10
                      {lastDiary.symptoms?.length > 0 && ` · ${lastDiary.symptoms.join(", ")}`}
                    </span>
                  </div>
                )}
                {lastVital && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <span style={{ color: "var(--accent)", opacity: 0.6 }}>●</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {lastVital.vital_type}: {lastVital.value} {lastVital.unit}
                    </span>
                  </div>
                )}
                {medsLen > 0 && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <span style={{ color: "var(--accent)", opacity: 0.6 }}>●</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {medsLen} {plural(medsLen, "активный препарат", "активных препарата", "активных препаратов")}
                    </span>
                  </div>
                )}
                {symptomsNode?.status && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <span style={{ color: "rgba(255,255,255,0.25)" }}>●</span>
                    <span style={{ color: "rgba(255,255,255,0.35)" }}>Симптомы: {symptomsNode.status}</span>
                  </div>
                )}
                {!lastDiary && !lastVital && medsLen === 0 && (
                  <p className="text-[12px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                    Данных пока нет. Начните с записи самочувствия.
                  </p>
                )}
              </div>
            </Link>

            {/* CTA inside left column — part of the panel flow */}
            <Link
              href={agentNextStep.href}
              className="group flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:brightness-110"
              style={{
                backgroundColor: "rgba(45,212,191,0.06)",
                border: "1px solid rgba(45,212,191,0.20)",
              }}
            >
              <span
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
                style={{ backgroundColor: "rgba(45,212,191,0.14)", color: "var(--accent)" }}
              >→</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                  {agentNextStep.text}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{agentNextStep.sub}</p>
              </div>
            </Link>
          </div>

          {/* RIGHT: Secondary module cards — 2 cols on sm+ */}
          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-1 gap-2">
            {satellites.map((n) => {
              const s = stateStyles[n.state];
              return (
                <Link
                  key={n.key}
                  href={n.href}
                  className="rounded-xl px-3.5 py-3 transition-all hover:brightness-110"
                  style={{ backgroundColor: s.bg, border: s.border }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: s.iconColor }}>{n.icon}</span>
                    <span className="text-[12px] font-bold" style={{ color: s.textColor }}>{n.label}</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-snug" style={{ color: s.statusColor, opacity: n.state === "empty" ? 0.5 : 0.9 }}>
                    {n.status}
                    {n.detail && <span style={{ color: "var(--text-muted)", opacity: 0.5 }}> · {n.detail}</span>}
                  </p>
                </Link>
              );
            })}
            {/* Lifestyle in right column */}
            <Link
              href={bridge.href}
              className="rounded-xl px-3.5 py-2.5 transition-all hover:brightness-110"
              style={{ backgroundColor: "rgba(45,212,191,0.03)", border: "1px solid rgba(45,212,191,0.10)" }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: bridgeS.iconColor }}>{bridge.icon}</span>
                <span className="text-[12px] font-bold" style={{ color: bridgeS.textColor }}>{bridge.label}</span>
              </div>
              <p className="mt-0.5 text-[10px]" style={{ color: bridgeS.statusColor, opacity: 0.6 }}>{bridge.status}</p>
            </Link>
          </div>
        </div>

        {/* ===== ROW 3: Map helper context if available ===== */}
        {mapHelper && (
          <p className="text-[10px] font-medium" style={{ color: "var(--accent)", opacity: 0.3 }}>
            {mapHelper}
          </p>
        )}

      </div>
    </div>
  );
}
