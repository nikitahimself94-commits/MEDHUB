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

  // Node positions — hub top-center, satellites around it in clear layers
  const nodePos: Record<string, [number, number]> = {
    wellbeing:    [50, 16],
    vitals:       [78, 32],
    documents:    [22, 44],
    medications:  [78, 60],
    lifestyle:    [50, 80],
    symptoms:     [62, 24],   // subordinate, tucked near hub/vitals
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
      <div className="relative px-4 sm:px-6 pt-8 sm:pt-10 pb-0">
        {/* Map field background — centered on hub */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-0" style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 18%, rgba(45,212,191,0.04) 0%, transparent 70%)",
        }} />
        {mapHelper && (
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--accent)", opacity: 0.4 }}>
            {mapHelper}
          </p>
        )}

        {/* Map container */}
        <div className="relative" style={{ height: "clamp(340px, 50vw, 440px)" }}>
          {/* SVG — only hub→satellite lines */}
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
                  stroke={isActive ? "rgba(45,212,191,0.40)" : "rgba(45,212,191,0.10)"}
                  strokeWidth={isActive ? "0.6" : "0.3"}
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
              const isSymptoms = n.key === "symptoms";
              const isBridge = n.key === "lifestyle";

              {/* Symptoms — small subordinate tag near hub */}
              if (isSymptoms) {
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    className="absolute flex items-center gap-1 rounded-full px-2.5 py-0.5 transition-all hover:brightness-125"
                    style={{
                      left: `${left}%`, top: `${top}%`,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: s.bg,
                      border: s.border,
                    }}
                  >
                    <span className="text-[10px]" style={{ color: s.iconColor }}>{n.icon}</span>
                    <span className="text-[10px] font-medium" style={{ color: s.textColor }}>{n.label}</span>
                  </Link>
                );
              }

              {/* Lifestyle — bridge node at bottom */}
              if (isBridge) {
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    className="absolute flex items-center gap-2 rounded-full px-4 py-1.5 transition-all hover:brightness-125"
                    style={{
                      left: `${left}%`, top: `${top}%`,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: s.bg,
                      border: s.border,
                    }}
                  >
                    <span className="text-[12px]" style={{ color: s.iconColor }}>{n.icon}</span>
                    <span className="text-[11px] font-semibold" style={{ color: s.textColor }}>{n.label}</span>
                    <span className="text-[10px]" style={{ color: s.statusColor, opacity: 0.6 }}>{n.status}</span>
                  </Link>
                );
              }

              {/* Hub — dominant center */}
              if (isHub) {
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    className="absolute flex flex-col items-center text-center rounded-[32px] px-6 py-6 sm:px-8 sm:py-7 transition-all hover:brightness-110 active:scale-[0.97]"
                    style={{
                      left: `${left}%`, top: `${top}%`,
                      transform: "translate(-50%, -50%)",
                      backgroundColor: s.bg,
                      border: s.border,
                      boxShadow: `${resolveGlow(s.glow, rel)}, 0 0 60px rgba(45,212,191,0.06)`,
                      width: "clamp(160px, 42%, 210px)",
                    }}
                  >
                    {rel && (
                      <span className="absolute top-2 right-3 rounded-full" style={{ width: 10, height: 10, backgroundColor: "var(--accent)", boxShadow: "0 0 12px rgba(45,212,191,0.5)" }} />
                    )}
                    <span className="text-5xl sm:text-6xl" style={{ color: s.iconColor }}>{n.icon}</span>
                    <span className="mt-2 text-[16px] sm:text-[18px] font-extrabold leading-tight" style={{ color: s.textColor }}>{n.label}</span>
                    <span className="mt-1 text-[12px]" style={{ color: s.statusColor, opacity: n.state === "empty" ? 0.5 : 0.9 }}>{n.status}</span>
                    {n.detail && (
                      <span className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>{n.detail}</span>
                    )}
                  </Link>
                );
              }

              {/* Satellite nodes — readable, visible, not microscopic */}
              return (
                <Link
                  key={n.key}
                  href={n.href}
                  className="absolute flex flex-col items-center text-center rounded-2xl px-3 py-3 transition-all hover:brightness-110 active:scale-[0.97]"
                  style={{
                    left: `${left}%`, top: `${top}%`,
                    transform: "translate(-50%, -50%)",
                    backgroundColor: s.bg,
                    border: s.border,
                    boxShadow: resolveGlow(s.glow, rel),
                    width: "clamp(100px, 26%, 130px)",
                  }}
                >
                  {rel && (
                    <span className="absolute top-1.5 right-1.5 rounded-full" style={{ width: 7, height: 7, backgroundColor: "var(--accent)", boxShadow: "0 0 12px rgba(45,212,191,0.5)" }} />
                  )}
                  <span className="text-xl" style={{ color: s.iconColor }}>{n.icon}</span>
                  <span className="mt-1 text-[12px] font-bold leading-tight" style={{ color: s.textColor }}>{n.label}</span>
                  <span className="mt-0.5 text-[10px]" style={{ color: s.statusColor, opacity: n.state === "empty" ? 0.5 : 0.9 }}>{n.status}</span>
                  {n.detail && (
                    <span className="mt-0.5 text-[9px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>{n.detail}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== NEXT ACTION — directly below map, tight spacing ===== */}
      <div className="px-4 sm:px-6 pt-3 pb-8 sm:pb-10">
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
