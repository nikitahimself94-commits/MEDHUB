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
    medications: "medications",
  };
  const relatedNodes = new Set<string>();
  const shownCorrelations = mco.correlations.slice(0, 2);
  for (const cor of shownCorrelations) {
    const fromNode = corKeyToNode[cor.from];
    const toNode = corKeyToNode[cor.to];
    if (fromNode) relatedNodes.add(fromNode);
    if (toNode) relatedNodes.add(toNode);
  }

  // Node positions — compact, centered constellation
  const nodePos: Record<string, [number, number]> = {
    wellbeing:    [50, 18],
    vitals:       [78, 34],
    documents:    [22, 46],
    medications:  [78, 60],
    lifestyle:    [50, 76],
  };
  const nodeCenters = nodePos;

  // Only hub→satellite structural lines — no cross-links between satellites
  const baseEdges: Array<[string, string]> = [
    ["wellbeing", "vitals"],
    ["wellbeing", "documents"],
    ["wellbeing", "medications"],
    ["wellbeing", "lifestyle"],
  ];
  const baseLines = baseEdges.map(([a, b]) => ({
    x1: nodeCenters[a][0], y1: nodeCenters[a][1],
    x2: nodeCenters[b][0], y2: nodeCenters[b][1],
  }));

  // Active correlations — expressed as strengthened hub-lines, not separate web
  const activeEdgeSet = new Set<string>();
  for (const cor of shownCorrelations) {
    const fromNode = corKeyToNode[cor.from];
    const toNode = corKeyToNode[cor.to];
    // Only strengthen edges that already exist (hub→satellite)
    for (const [a, b] of baseEdges) {
      if ((a === fromNode && b === toNode) || (a === toNode && b === fromNode) ||
          (a === fromNode || b === fromNode) || (a === toNode || b === toNode)) {
        // strengthen if either end matches a correlated module
        if ((fromNode === a || fromNode === b) && (toNode === a || toNode === b)) {
          activeEdgeSet.add(`${a}-${b}`);
        }
      }
    }
  }

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
        <div className="pointer-events-none absolute inset-0" style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(45,212,191,0.06) 0%, transparent 55%)",
        }} />

        <div className="relative px-5 sm:px-8 pt-7 sm:pt-8 pb-3 sm:pb-4">
          <h1
            className="text-[22px] sm:text-[28px] lg:text-[32px] font-bold leading-[1.15] tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {agentOpening}
          </h1>

          <p
            className="mt-2 text-[14px] sm:text-[15px] leading-[1.5] max-w-lg"
            style={{ color: "var(--text-muted)" }}
          >
            {agentObservation}
          </p>

          {unlockMessage && (
            <p className="mt-2 text-[13px] font-medium" style={{ color: "var(--accent)" }}>
              {unlockMessage}
            </p>
          )}

          {evidence.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {evidence.map((e) => (
                <Link
                  key={e.label}
                  href={e.href}
                  className="rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide transition-all hover:scale-105"
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
      <div className="relative px-3 sm:px-5 pt-0 pb-0">
        {mapHelper && (
          <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--accent)", opacity: 0.35 }}>
            {mapHelper}
          </p>
        )}

        {/* Map container — compact */}
        <div className="relative" style={{ height: "clamp(280px, 42vw, 360px)" }}>
          {/* SVG — hub→satellite lines, clearly visible */}
          <svg
            className="pointer-events-none absolute inset-0 z-10"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%" }}
          >
            {baseLines.map((line, i) => {
              const edgeKey = `${baseEdges[i][0]}-${baseEdges[i][1]}`;
              const isActive = activeEdgeSet.has(edgeKey);
              return (
                <line
                  key={`line-${i}`}
                  x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                  stroke={isActive ? "rgba(45,212,191,0.55)" : "rgba(45,212,191,0.22)"}
                  strokeWidth={isActive ? "0.75" : "0.5"}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {/* Nodes */}
          <div className="absolute inset-0">
            {nodes.map((n) => {
              const s = stateStyles[n.state];
              const rel = relatedNodes.has(n.key);
              const [left, top] = nodePos[n.key];
              const isHub = n.key === "wellbeing";
              const isVitals = n.key === "vitals";
              const isBridge = n.key === "lifestyle";

              {/* Lifestyle — bridge pill */}
              if (isBridge) {
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    className="absolute flex items-center gap-2 rounded-full px-3.5 py-1.5 transition-all hover:brightness-125"
                    style={{
                      left: `${left}%`, top: `${top}%`,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: "rgba(45,212,191,0.04)",
                      border: "1px solid rgba(45,212,191,0.12)",
                    }}
                  >
                    <span className="text-[11px]" style={{ color: s.iconColor }}>{n.icon}</span>
                    <span className="text-[11px] font-semibold" style={{ color: s.textColor }}>{n.label}</span>
                    <span className="text-[9px]" style={{ color: s.statusColor, opacity: 0.6 }}>{n.status}</span>
                  </Link>
                );
              }

              {/* Hub — primary but not oversized */}
              if (isHub) {
                const symptomsNode = modules.find((m) => m.key === "symptoms");
                const symptomsText = symptomsNode?.status;
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    className="absolute flex flex-col items-center text-center rounded-2xl px-4 py-4 sm:px-5 sm:py-4 transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{
                      left: `${left}%`, top: `${top}%`,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: s.bg,
                      border: s.border,
                      boxShadow: resolveGlow(s.glow, rel),
                      width: "clamp(120px, 32%, 160px)",
                    }}
                  >
                    {rel && (
                      <span className="absolute top-1.5 right-2 rounded-full" style={{ width: 8, height: 8, backgroundColor: "var(--accent)", boxShadow: "0 0 10px rgba(45,212,191,0.5)" }} />
                    )}
                    <span className="text-3xl" style={{ color: s.iconColor }}>{n.icon}</span>
                    <span className="mt-1 text-[13px] sm:text-[14px] font-bold leading-tight" style={{ color: s.textColor }}>{n.label}</span>
                    <span className="mt-0.5 text-[11px]" style={{ color: s.statusColor, opacity: n.state === "empty" ? 0.5 : 0.9 }}>{n.status}</span>
                    {symptomsText && (
                      <span className="mt-1 text-[9px] font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>
                        симптомы · {symptomsText}
                      </span>
                    )}
                  </Link>
                );
              }

              {/* Vitals — secondary */}
              if (isVitals) {
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    className="absolute flex flex-col items-center text-center rounded-xl px-3 py-2.5 transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{
                      left: `${left}%`, top: `${top}%`,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: s.bg,
                      border: s.border,
                      boxShadow: resolveGlow(s.glow, rel),
                      width: "clamp(90px, 24%, 120px)",
                    }}
                  >
                    {rel && (
                      <span className="absolute top-1 right-1.5 rounded-full" style={{ width: 6, height: 6, backgroundColor: "var(--accent)", boxShadow: "0 0 8px rgba(45,212,191,0.5)" }} />
                    )}
                    <span className="text-lg" style={{ color: s.iconColor }}>{n.icon}</span>
                    <span className="mt-0.5 text-[11px] font-bold leading-tight" style={{ color: s.textColor }}>{n.label}</span>
                    <span className="mt-0.5 text-[10px]" style={{ color: s.statusColor, opacity: n.state === "empty" ? 0.5 : 0.9 }}>{n.status}</span>
                  </Link>
                );
              }

              {/* Tertiary nodes */}
              const isMeds = n.key === "medications";
              return (
                <Link
                  key={n.key}
                  href={n.href}
                  className="absolute flex flex-col items-center text-center rounded-xl px-2.5 py-2 transition-all hover:brightness-110 active:scale-[0.97]"
                  style={{
                    left: `${left}%`, top: `${top}%`,
                    transform: "translate(-50%, -50%)",
                    backgroundColor: s.bg,
                    border: s.border,
                    boxShadow: resolveGlow(s.glow, rel),
                    width: isMeds ? "clamp(88px, 24%, 110px)" : "clamp(80px, 22%, 100px)",
                  }}
                >
                  {rel && (
                    <span className="absolute top-1 right-1 rounded-full" style={{ width: 6, height: 6, backgroundColor: "var(--accent)", boxShadow: "0 0 8px rgba(45,212,191,0.5)" }} />
                  )}
                  <span className={isMeds ? "text-base" : "text-sm"} style={{ color: s.iconColor }}>{n.icon}</span>
                  <span className="mt-0.5 text-[10px] font-bold leading-tight" style={{ color: s.textColor }}>{n.label}</span>
                  <span className="mt-0.5 text-[9px]" style={{ color: s.statusColor, opacity: n.state === "empty" ? 0.5 : 0.9 }}>{n.status}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== NEXT ACTION ===== */}
      <div className="px-4 sm:px-6 pt-2 pb-6 sm:pb-8">
        <Link
          href={agentNextStep.href}
          className="group relative block rounded-2xl px-4 py-4 sm:py-5 transition-all hover:brightness-110 active:scale-[0.995] overflow-hidden"
          style={{
            backgroundColor: "rgba(45,212,191,0.05)",
            border: "1px solid rgba(45,212,191,0.20)",
          }}
        >
          <div className="relative flex items-center gap-4">
            <span
              className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold transition-transform group-hover:scale-110"
              style={{ backgroundColor: "rgba(45,212,191,0.12)", color: "var(--accent)" }}
            >
              →
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] sm:text-[17px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>
                {agentNextStep.text}
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                {agentNextStep.sub}
              </p>
            </div>
            <span
              className="shrink-0 text-lg font-bold transition-transform group-hover:translate-x-1"
              style={{ color: "var(--accent)", opacity: 0.3 }}
            >
              →
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}
