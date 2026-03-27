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
    size: "lg" | "md" | "sm";
  }

  // --- Compact factual details from already-fetched data ---
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
      icon: "♡", size: "lg",
    },
    {
      key: "vitals", label: "Показатели", href: "/vitals",
      status: modByKey.vitals?.status ?? "нет данных",
      detail: vitalsLen > 0 ? `${vitalsLen} ${plural(vitalsLen, "значение", "значения", "значений")}` : null,
      state: nodeState(c.vitals, pri === "add_vitals", !!modByKey.vitals?.stale),
      icon: "〜", size: "md",
    },
    {
      key: "documents", label: "Документы", href: "/documents",
      status: modByKey.documents?.status ?? "нет загрузок",
      detail: docsLen > 0 ? `${docsLen} ${plural(docsLen, "файл", "файла", "файлов")}` : null,
      state: nodeState(c.documents, pri === "upload_document", false),
      icon: "▤", size: "md",
    },
    {
      key: "medications", label: "Лекарства", href: "/medications",
      status: modByKey.medications?.status ?? "нет данных",
      detail: medsLen > 0 ? `${medsLen} ${plural(medsLen, "активное", "активных", "активных")}` : null,
      state: nodeState(c.medications, pri === "add_medications", false),
      icon: "⊕", size: "md",
    },
    {
      key: "symptoms", label: "Симптомы", href: "/symptoms-map",
      status: modByKey.symptoms?.status ?? "нет данных",
      detail: null,
      state: nodeState(c.symptoms, false, false),
      icon: "◎", size: "sm",
    },
    {
      key: "lifestyle", label: "Образ жизни", href: "/timeline",
      status: modByKey.lifestyle?.status ?? "нет активности",
      detail: null,
      state: nodeState(c.diary > 0 || c.vitals > 0 ? 1 : 0, false, !!modByKey.lifestyle?.stale),
      icon: "↻", size: "sm",
    },
  ];

  // --- Correlation relation cues ---
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
  const RELATION_GLOW = "0 0 32px rgba(45,212,191,0.14)";
  function nodeGlow(baseGlow: string, isRelated: boolean): string {
    if (!isRelated) return baseGlow;
    if (baseGlow === "none") return RELATION_GLOW;
    return `${baseGlow}, ${RELATION_GLOW}`;
  }

  // --- SVG connection lines between correlated nodes ---
  // Approximate node centers as % within the grid (3-col, 3-row)
  const nodeCenters: Record<string, [number, number]> = {
    wellbeing: [33, 18],
    vitals: [83, 18],
    documents: [17, 52],
    medications: [50, 52],
    symptoms: [83, 52],
    lifestyle: [50, 85],
  };
  const connectionLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (const cor of shownCorrelations) {
    const from = nodeCenters[corKeyToNode[cor.from]];
    const to = nodeCenters[corKeyToNode[cor.to]];
    if (from && to) {
      connectionLines.push({ x1: from[0], y1: from[1], x2: to[0], y2: to[1] });
    }
  }

  const stateStyles: Record<MapNode["state"], { bg: string; border: string; glow: string; icon: string; label: string; status: string }> = {
    empty: {
      bg: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      glow: "none",
      icon: "var(--text-muted)",
      label: "var(--text-muted)",
      status: "var(--text-muted)",
    },
    active: {
      bg: "rgba(45,212,191,0.04)",
      border: "1px solid rgba(45,212,191,0.18)",
      glow: "0 0 24px rgba(45,212,191,0.08)",
      icon: "var(--accent)",
      label: "var(--text-primary)",
      status: "var(--accent)",
    },
    stale: {
      bg: "rgba(251,191,36,0.03)",
      border: "1px solid rgba(251,191,36,0.12)",
      glow: "0 0 20px rgba(251,191,36,0.05)",
      icon: "var(--text-muted)",
      label: "var(--text-primary)",
      status: "rgba(251,191,36,0.7)",
    },
    attention: {
      bg: "rgba(245,158,11,0.04)",
      border: "1px solid rgba(245,158,11,0.25)",
      glow: "0 0 28px rgba(245,158,11,0.1)",
      icon: "var(--amber)",
      label: "var(--text-primary)",
      status: "var(--amber)",
    },
  };

  // --- Consolidated presence insight (only when it adds real signal) ---
  const insightLines: string[] = [];
  if (mco.recent_patterns.length > 0) insightLines.push(mco.recent_patterns[0]);
  if (mco.open_questions.length > 0 && mco.open_questions[0] !== agentObservation) {
    insightLines.push(mco.open_questions[0]);
  }

  return (
    <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
      {process.env.NODE_ENV !== "production" && <ReviewReset />}
      <FirstArrivalOverlay show={isFirstArrival} />

      {/* ===== AGENT ZONE — dominant presence ===== */}
      <section
        data-hero
        className="relative"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        {/* Ambient glow — stronger */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 80% 70% at 50% 10%, rgba(45,212,191,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="relative px-5 sm:px-8 pt-10 sm:pt-14 pb-8 sm:pb-10">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--accent)", opacity: 0.6 }}
          >
            Твой помощник
          </p>

          {/* Headline — larger, more dominant */}
          <h1
            className="mt-4 text-[26px] sm:text-[34px] lg:text-[40px] font-bold leading-[1.15] tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {agentOpening}
          </h1>

          {/* Main observation — reads as "verdict" */}
          <p
            className="mt-4 text-[16px] sm:text-[18px] leading-[1.6] max-w-2xl"
            style={{ color: "var(--text-muted)" }}
          >
            {agentObservation}
          </p>

          {/* Agent insight — flat, no nested card */}
          {(insightLines.length > 0 || unlockMessage) && (
            <div className="mt-5 space-y-1">
              {unlockMessage && (
                <p className="text-[13px] font-medium" style={{ color: "var(--accent)" }}>
                  {unlockMessage}
                </p>
              )}
              {insightLines.map((line, i) => (
                <p key={i} className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)", opacity: 0.75 }}>
                  {line}
                </p>
              ))}
            </div>
          )}

          {/* Evidence tags */}
          {evidence.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {evidence.map((e) => (
                <Link
                  key={e.label}
                  href={e.href}
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium transition-all hover:scale-105"
                  style={{
                    backgroundColor: "rgba(45,212,191,0.06)",
                    color: "var(--accent)",
                    border: "1px solid rgba(45,212,191,0.12)",
                  }}
                >
                  {e.label} · {e.detail}
                </Link>
              ))}
            </div>
          )}

        </div>

        {/* Separator gradient */}
        <div
          className="h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(45,212,191,0.12) 30%, rgba(45,212,191,0.12) 70%, transparent)" }}
        />
      </section>

      {/* ===== HEALTH MAP — spatial node composition ===== */}
      <div className="px-4 sm:px-6 pt-6 sm:pt-8 pb-2">
        {mapHelper && (
          <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)", opacity: 0.45 }}>
            {mapHelper}
          </p>
        )}

        <div className="relative">
          {/* SVG connection lines overlay */}
          {connectionLines.length > 0 && (
            <svg
              className="pointer-events-none absolute inset-0 z-10"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{ width: "100%", height: "100%" }}
            >
              {connectionLines.map((line, i) => (
                <line
                  key={i}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  stroke="rgba(45,212,191,0.18)"
                  strokeWidth="0.3"
                  strokeLinecap="round"
                  strokeDasharray="1.5 1"
                />
              ))}
            </svg>
          )}

          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: "1fr 1fr 1fr",
              gridTemplateRows: "auto auto auto",
            }}
          >
            {/* Row 1: Самочувствие (2 cols, hero node) + Цифры */}
            {(() => {
              const wb = nodes[0];
              const ws = stateStyles[wb.state];
              const isRelated = relatedNodes.has(wb.key);
              return (
                <Link
                  key={wb.key}
                  href={wb.href}
                  className="relative col-span-2 flex items-center gap-4 rounded-2xl px-5 py-6 transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ backgroundColor: ws.bg, border: ws.border, boxShadow: nodeGlow(ws.glow, isRelated) }}
                >
                  {isRelated && <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)", opacity: 0.6, boxShadow: "0 0 8px rgba(45,212,191,0.4)" }} />}
                  <span className="text-4xl" style={{ color: ws.icon }}>{wb.icon}</span>
                  <div>
                    <span className="text-[16px] font-bold" style={{ color: ws.label }}>{wb.label}</span>
                    <span className="block text-[12px] mt-1" style={{ color: ws.status, opacity: wb.state === "empty" ? 0.5 : 1 }}>{wb.status}</span>
                    {wb.detail && <span className="block text-[10px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.45 }}>{wb.detail}</span>}
                  </div>
                </Link>
              );
            })()}
            {(() => {
              const nd = nodes[1];
              const ns = stateStyles[nd.state];
              const isRelated = relatedNodes.has(nd.key);
              return (
                <Link
                  key={nd.key}
                  href={nd.href}
                  className="relative flex flex-col items-center justify-center text-center rounded-2xl px-2 py-5 transition-all hover:brightness-110 active:scale-[0.97]"
                  style={{ backgroundColor: ns.bg, border: ns.border, boxShadow: nodeGlow(ns.glow, isRelated) }}
                >
                  {isRelated && <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)", opacity: 0.6, boxShadow: "0 0 8px rgba(45,212,191,0.4)" }} />}
                  <span className="text-2xl" style={{ color: ns.icon }}>{nd.icon}</span>
                  <span className="mt-2 text-[12px] font-semibold" style={{ color: ns.label }}>{nd.label}</span>
                  <span className="mt-0.5 text-[10px]" style={{ color: ns.status, opacity: nd.state === "empty" ? 0.5 : 1 }}>{nd.status}</span>
                  {nd.detail && <span className="mt-0.5 text-[9px]" style={{ color: "var(--text-muted)", opacity: 0.4 }}>{nd.detail}</span>}
                </Link>
              );
            })()}

            {/* Row 2: Документы + Лекарства + Симптомы */}
            {nodes.slice(2, 5).map((node) => {
              const s = stateStyles[node.state];
              const isRelated = relatedNodes.has(node.key);
              return (
                <Link
                  key={node.key}
                  href={node.href}
                  className="relative flex flex-col items-center justify-center text-center rounded-2xl px-2 py-5 transition-all hover:brightness-110 active:scale-[0.97]"
                  style={{ backgroundColor: s.bg, border: s.border, boxShadow: nodeGlow(s.glow, isRelated) }}
                >
                  {isRelated && <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)", opacity: 0.6, boxShadow: "0 0 8px rgba(45,212,191,0.4)" }} />}
                  <span className="text-xl" style={{ color: s.icon }}>{node.icon}</span>
                  <span className="mt-2 text-[12px] font-semibold leading-tight" style={{ color: s.label }}>{node.label}</span>
                  <span className="mt-0.5 text-[10px]" style={{ color: s.status, opacity: node.state === "empty" ? 0.5 : 1 }}>{node.status}</span>
                  {node.detail && <span className="mt-0.5 text-[9px]" style={{ color: "var(--text-muted)", opacity: 0.4 }}>{node.detail}</span>}
                </Link>
              );
            })}

            {/* Row 3: Образ жизни (spans 3 cols) */}
            {(() => {
              const lf = nodes[5];
              const ls = stateStyles[lf.state];
              return (
                <Link
                  key={lf.key}
                  href={lf.href}
                  className="col-span-3 flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ backgroundColor: ls.bg, border: ls.border, boxShadow: ls.glow }}
                >
                  <span className="text-base" style={{ color: ls.icon }}>{lf.icon}</span>
                  <span className="text-[12px] font-semibold" style={{ color: ls.label }}>{lf.label}</span>
                  <span className="text-[11px] ml-auto" style={{ color: ls.status, opacity: lf.state === "empty" ? 0.5 : 1 }}>{lf.status}</span>
                </Link>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ===== NEXT STEP — decisive action ===== */}
      <div className="px-4 sm:px-6 pt-5 pb-6 sm:pb-8">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)", opacity: 0.5 }}>
          Следующий шаг
        </p>
        <Link
          href={agentNextStep.href}
          className="group flex items-center gap-4 rounded-2xl px-5 py-4 transition-all hover:brightness-110 active:scale-[0.99]"
          style={{
            backgroundColor: "rgba(45,212,191,0.05)",
            border: "1px solid rgba(45,212,191,0.18)",
            boxShadow: "0 0 32px rgba(45,212,191,0.05)",
          }}
        >
          <span
            className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold transition-transform group-hover:scale-105"
            style={{ backgroundColor: "rgba(45,212,191,0.10)", color: "var(--accent)" }}
          >
            →
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
              {agentNextStep.text}
            </p>
            <p className="mt-0.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
              {agentNextStep.sub}
            </p>
            {mco.pending_nudges.length > 1 && (
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                {mco.pending_nudges[1]}
              </p>
            )}
          </div>
          <span
            className="shrink-0 text-base font-medium transition-transform group-hover:translate-x-1"
            style={{ color: "var(--accent)", opacity: 0.5 }}
          >
            →
          </span>
        </Link>
      </div>
    </div>
  );
}
