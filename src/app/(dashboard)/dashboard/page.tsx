import Link from "next/link";
import { getSessionPatient } from "@/lib/get-patient-id";
import { getOrRefreshMco } from "@/lib/mco";
import { ServerRotation, type RotationState } from "@/lib/template-rotation";
import { paraphraseHeroOpening } from "@/lib/haiku-paraphrase";
import { OnboardingGate } from "./onboarding-gate";
import { FirstArrivalOverlay } from "./first-arrival-overlay";
import { ReviewReset } from "./review-reset";
import { heroOpening, heroObservation, heroNextStep, heroEvidence, heroUnlockMessage, heroMapHelper } from "./hero-from-mco";
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
  const evidence = heroEvidence(mco);
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
      key: "symptoms", label: "Симптомы", href: "/symptoms-map",
      status: modByKey.symptoms?.status ?? "нет данных",
      detail: null,
      state: nodeState(c.symptoms, false, false),
      icon: "◎",
    },
    {
      key: "lifestyle", label: "Образ жизни", href: "/timeline",
      status: modByKey.lifestyle?.status ?? "нет активности",
      detail: null,
      state: nodeState(c.diary > 0 || c.vitals > 0 ? 1 : 0, false, !!modByKey.lifestyle?.stale),
      icon: "↻",
    },
  ];

  // --- Correlations ---
  const corKeyToNode: Record<string, string> = {
    diary: "wellbeing", emotions: "wellbeing",
    vitals: "vitals", documents: "documents",
    medications: "medications", symptoms: "symptoms",
  };
  const relatedNodes = new Set<string>();
  const shownCorrelations = mco.correlations.slice(0, 2);
  for (const cor of shownCorrelations) {
    const fromNode = corKeyToNode[cor.from];
    const toNode = corKeyToNode[cor.to];
    if (fromNode) relatedNodes.add(fromNode);
    if (toNode) relatedNodes.add(toNode);
  }

  // Node positions as [left%, top%] within the map canvas
  // Same coordinates used for SVG (viewBox 0 0 100 100) and CSS absolute placement
  const nodePos: Record<string, [number, number]> = {
    wellbeing: [50, 20],
    vitals: [82, 38],
    documents: [16, 48],
    medications: [68, 62],
    symptoms: [84, 82],
    lifestyle: [40, 93],
  };
  const nodeCenters = nodePos;

  // Structural base map — always visible, shows the system skeleton
  const baseEdges: Array<[string, string]> = [
    ["wellbeing", "vitals"],
    ["wellbeing", "documents"],
    ["wellbeing", "medications"],
    ["vitals", "documents"],
    ["vitals", "symptoms"],
    ["medications", "documents"],
    ["medications", "lifestyle"],
    ["wellbeing", "lifestyle"],
  ];
  const baseLines = baseEdges.map(([a, b]) => ({
    x1: nodeCenters[a][0], y1: nodeCenters[a][1],
    x2: nodeCenters[b][0], y2: nodeCenters[b][1],
  }));

  // Active correlation lines — only from real MCO data
  const activeLineKeys = new Set<string>();
  const activeLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (const cor of shownCorrelations) {
    const fromNode = corKeyToNode[cor.from];
    const toNode = corKeyToNode[cor.to];
    const from = nodeCenters[fromNode];
    const to = nodeCenters[toNode];
    if (from && to) {
      activeLines.push({ x1: from[0], y1: from[1], x2: to[0], y2: to[1] });
      activeLineKeys.add(`${fromNode}-${toNode}`);
      activeLineKeys.add(`${toNode}-${fromNode}`);
    }
  }

  const stateStyles: Record<MapNode["state"], { bg: string; border: string; glow: string; iconColor: string; textColor: string; statusColor: string }> = {
    empty: {
      bg: "rgba(255,255,255,0.015)",
      border: "1px solid rgba(255,255,255,0.05)",
      glow: "none",
      iconColor: "rgba(255,255,255,0.2)",
      textColor: "rgba(255,255,255,0.3)",
      statusColor: "rgba(255,255,255,0.25)",
    },
    active: {
      bg: "rgba(45,212,191,0.05)",
      border: "1px solid rgba(45,212,191,0.22)",
      glow: "0 0 30px rgba(45,212,191,0.10)",
      iconColor: "var(--accent)",
      textColor: "var(--text-primary)",
      statusColor: "var(--accent)",
    },
    stale: {
      bg: "rgba(251,191,36,0.03)",
      border: "1px solid rgba(251,191,36,0.15)",
      glow: "0 0 24px rgba(251,191,36,0.06)",
      iconColor: "rgba(251,191,36,0.6)",
      textColor: "var(--text-primary)",
      statusColor: "rgba(251,191,36,0.7)",
    },
    attention: {
      bg: "rgba(245,158,11,0.05)",
      border: "1px solid rgba(245,158,11,0.30)",
      glow: "0 0 36px rgba(245,158,11,0.12)",
      iconColor: "var(--amber)",
      textColor: "var(--text-primary)",
      statusColor: "var(--amber)",
    },
  };

  function resolveGlow(base: string, isRelated: boolean): string {
    if (!isRelated) return base;
    const relGlow = "0 0 40px rgba(45,212,191,0.18)";
    if (base === "none") return relGlow;
    return `${base}, ${relGlow}`;
  }

  return (
    <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
      {process.env.NODE_ENV !== "production" && <ReviewReset />}
      <FirstArrivalOverlay show={isFirstArrival} />

      {/* ===== AGENT PRESENCE ===== */}
      <section className="relative overflow-hidden" style={{ backgroundColor: "var(--bg-surface)" }}>
        {/* Deep layered glow */}
        <div className="pointer-events-none absolute inset-0" style={{
          background: "radial-gradient(ellipse 90% 80% at 50% 0%, rgba(45,212,191,0.09) 0%, transparent 60%)",
        }} />
        <div className="pointer-events-none absolute inset-0" style={{
          background: "radial-gradient(circle 400px at 30% 80%, rgba(45,212,191,0.03) 0%, transparent 70%)",
        }} />

        <div className="relative px-5 sm:px-8 pt-12 sm:pt-16 pb-10 sm:pb-14">
          <h1
            className="text-[30px] sm:text-[40px] lg:text-[48px] font-extrabold leading-[1.08] tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {agentOpening}
          </h1>

          <p
            className="mt-5 text-[17px] sm:text-[20px] leading-[1.55] max-w-xl"
            style={{ color: "var(--text-muted)" }}
          >
            {agentObservation}
          </p>

          {unlockMessage && (
            <p className="mt-4 text-[14px] font-medium" style={{ color: "var(--accent)" }}>
              {unlockMessage}
            </p>
          )}

          {evidence.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {evidence.map((e) => (
                <Link
                  key={e.label}
                  href={e.href}
                  className="rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-wide transition-all hover:scale-105"
                  style={{
                    backgroundColor: "rgba(45,212,191,0.08)",
                    color: "var(--accent)",
                    border: "1px solid rgba(45,212,191,0.15)",
                  }}
                >
                  {e.label} · {e.detail}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== HEALTH MAP ===== */}
      <div className="relative px-4 sm:px-6 pt-8 sm:pt-10 pb-4">
        {/* Map field background — centered on hub */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-0" style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 25%, rgba(45,212,191,0.04) 0%, transparent 70%)",
        }} />
        {mapHelper && (
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--accent)", opacity: 0.4 }}>
            {mapHelper}
          </p>
        )}

        {/* Map container — height from the absolute-positioned canvas child */}
        <div className="relative" style={{ height: "clamp(380px, 55vw, 500px)" }}>
          {/* SVG lines — stretches to fill container so coordinates match CSS % */}
          <svg
            className="pointer-events-none absolute inset-0 z-10"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%" }}
          >
            <defs>
              <filter id="active-glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Layer 1: Structural base — always visible, the system skeleton */}
            {baseLines.map((line, i) => {
              const key = `${baseEdges[i][0]}-${baseEdges[i][1]}`;
              const isActive = activeLineKeys.has(key);
              if (isActive) return null;
              return (
                <line
                  key={`base-${i}`}
                  x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                  stroke="rgba(45,212,191,0.14)"
                  strokeWidth="0.35"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Node anchor dots — always visible, hub dot is largest */}
            {Object.entries(nodeCenters).map(([key, [cx, cy]]) => (
              <circle
                key={`dot-${key}`}
                cx={cx}
                cy={cy}
                r={key === "wellbeing" ? 2.5 : key === "lifestyle" ? 0.8 : 1.2}
                fill={relatedNodes.has(key) ? "rgba(45,212,191,0.6)" : "rgba(45,212,191,0.15)"}
              />
            ))}

            {/* Hub ring — always visible, marks the center of the system */}
            <circle
              cx={nodePos.wellbeing[0]}
              cy={nodePos.wellbeing[1]}
              r="12"
              fill="none"
              stroke="rgba(45,212,191,0.06)"
              strokeWidth="0.3"
            />

            {/* Layer 2: Active correlations — strong visible signal */}
            {activeLines.map((line, i) => (
              <g key={`active-${i}`}>
                <line
                  x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                  stroke="rgba(45,212,191,0.15)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  filter="url(#active-glow)"
                />
                <line
                  x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                  stroke="rgba(45,212,191,0.50)"
                  strokeWidth="0.8"
                  strokeLinecap="round"
                />
                <circle cx={line.x1} cy={line.y1} r="2" fill="rgba(45,212,191,0.6)" />
                <circle cx={line.x2} cy={line.y2} r="2" fill="rgba(45,212,191,0.6)" />
              </g>
            ))}
          </svg>

          {/* Spatial map canvas — nodes placed absolutely within parent's height */}
          <div className="absolute inset-0">
            {nodes.map((n) => {
              const s = stateStyles[n.state];
              const rel = relatedNodes.has(n.key);
              const [left, top] = nodePos[n.key];
              const isHub = n.key === "wellbeing";
              const isBridge = n.key === "lifestyle";
              const isSecondary = n.key === "vitals";
              if (isBridge) {
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    className="absolute flex items-center gap-1.5 rounded-full px-4 py-1 transition-all hover:brightness-125"
                    style={{
                      left: `${left}%`, top: `${top}%`,
                      transform: "translate(-50%, -50%)",
                      border: `1px solid ${n.state === "empty" ? "rgba(255,255,255,0.04)" : "rgba(45,212,191,0.10)"}`,
                    }}
                  >
                    <span className="text-[10px]" style={{ color: s.iconColor }}>{n.icon}</span>
                    <span className="text-[9px] font-medium" style={{ color: s.textColor }}>{n.label}</span>
                    <span className="text-[8px]" style={{ color: s.statusColor, opacity: 0.5 }}>{n.status}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={n.key}
                  href={n.href}
                  className={`absolute flex flex-col items-center text-center transition-all hover:brightness-110 active:scale-[0.97] ${
                    isHub ? "rounded-[32px] px-6 py-6 sm:px-8 sm:py-8" :
                    isSecondary ? "rounded-2xl px-3 py-3.5" :
                    "rounded-xl px-2 py-2.5"
                  }`}
                  style={{
                    left: `${left}%`, top: `${top}%`,
                    transform: "translate(-50%, -50%)",
                    backgroundColor: s.bg,
                    border: s.border,
                    boxShadow: isHub
                      ? `${resolveGlow(s.glow, rel)}, 0 0 60px rgba(45,212,191,0.06)`
                      : resolveGlow(s.glow, rel),
                    width: isHub ? "clamp(160px, 44%, 220px)" : isSecondary ? "clamp(90px, 24%, 120px)" : "clamp(72px, 20%, 96px)",
                  }}
                >
                  {rel && (
                    <span
                      className={`absolute ${isHub ? "top-2 right-3" : "top-1.5 right-1.5"} rounded-full`}
                      style={{
                        width: isHub ? 10 : 7, height: isHub ? 10 : 7,
                        backgroundColor: "var(--accent)",
                        boxShadow: "0 0 12px rgba(45,212,191,0.5)",
                      }}
                    />
                  )}
                  <span className={isHub ? "text-5xl sm:text-6xl" : isSecondary ? "text-xl" : "text-base"} style={{ color: s.iconColor }}>
                    {n.icon}
                  </span>
                  <span
                    className={`leading-tight ${isHub ? "mt-2 text-[16px] sm:text-[18px] font-extrabold" : isSecondary ? "mt-1 text-[10px] font-bold" : "mt-1 text-[9px] font-semibold"}`}
                    style={{ color: s.textColor }}
                  >
                    {n.label}
                  </span>
                  <span
                    className={isHub ? "mt-1 text-[12px]" : "mt-0.5 text-[8px]"}
                    style={{ color: s.statusColor, opacity: n.state === "empty" ? 0.4 : 0.9 }}
                  >
                    {n.status}
                  </span>
                  {isHub && n.detail && (
                    <span className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.4 }}>
                      {n.detail}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== NEXT ACTION — the one decisive move ===== */}
      <div className="px-4 sm:px-6 pt-8 pb-8 sm:pb-10">
        <Link
          href={agentNextStep.href}
          className="group relative block rounded-3xl px-6 py-7 sm:py-8 transition-all hover:brightness-110 active:scale-[0.995] overflow-hidden"
          style={{
            backgroundColor: "rgba(45,212,191,0.07)",
            border: "2px solid rgba(45,212,191,0.30)",
            boxShadow: "0 0 60px rgba(45,212,191,0.10), inset 0 1px 0 rgba(45,212,191,0.08)",
          }}
        >
          <div className="pointer-events-none absolute inset-0" style={{
            background: "radial-gradient(ellipse 70% 100% at 10% 50%, rgba(45,212,191,0.08) 0%, transparent 60%)",
          }} />
          <div className="relative flex items-center gap-5">
            <span
              className="shrink-0 flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold transition-transform group-hover:scale-110"
              style={{ backgroundColor: "rgba(45,212,191,0.15)", color: "var(--accent)" }}
            >
              →
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--accent)", opacity: 0.5 }}>
                Следующий шаг
              </p>
              <p className="mt-1.5 text-[18px] sm:text-[21px] font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>
                {agentNextStep.text}
              </p>
              <p className="mt-1 text-[14px]" style={{ color: "var(--text-muted)" }}>
                {agentNextStep.sub}
              </p>
            </div>
            <span
              className="shrink-0 text-2xl font-bold transition-transform group-hover:translate-x-2"
              style={{ color: "var(--accent)", opacity: 0.35 }}
            >
              →
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
