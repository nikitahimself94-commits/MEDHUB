import Link from "next/link";
import { getSessionPatient } from "@/lib/get-patient-id";
import { getOrRefreshMco } from "@/lib/mco";
import { ServerRotation, type RotationState } from "@/lib/template-rotation";
import { paraphraseHeroOpening } from "@/lib/haiku-paraphrase";
import { OnboardingGate } from "./onboarding-gate";
import { FirstArrivalOverlay } from "./first-arrival-overlay";
import { ReviewReset } from "./review-reset";
import { heroOpening, heroObservation, heroNextStep, heroEvidence, heroUnlockMessage, heroMapHelper, heroSectionNudges } from "./hero-from-mco";
import { AgentHint } from "./agent-hint";
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
  const sectionNudges = heroSectionNudges(mco);

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
    state: "empty" | "active" | "attention";
    icon: string;
    size: "lg" | "md" | "sm";
  }

  function nodeState(score: number, isPriority: boolean): MapNode["state"] {
    if (isPriority) return "attention";
    if (score > 0) return "active";
    return "empty";
  }

  const diaryMod = modules.find((m) => m.key === "diary");
  const vitalsMod = modules.find((m) => m.key === "vitals");
  const docsMod = modules.find((m) => m.key === "documents");
  const medsMod = modules.find((m) => m.key === "medications");
  const symptomsMod = modules.find((m) => m.key === "symptoms");

  const nodes: MapNode[] = [
    {
      key: "wellbeing", label: "Самочувствие", href: "/diary",
      status: diaryMod?.status ?? "пока пусто",
      state: nodeState(Math.max(c.diary, c.emotions), pri === "add_diary" || pri === "update_diary" || pri === "add_emotions"),
      icon: "♡", size: "lg",
    },
    {
      key: "vitals", label: "Цифры", href: "/vitals",
      status: vitalsMod?.status ?? "пока пусто",
      state: nodeState(c.vitals, pri === "add_vitals"),
      icon: "〜", size: "md",
    },
    {
      key: "documents", label: "Документы", href: "/documents",
      status: docsMod?.status ?? "пока пусто",
      state: nodeState(c.documents, pri === "upload_document"),
      icon: "▤", size: "md",
    },
    {
      key: "medications", label: "Лекарства", href: "/medications",
      status: medsMod?.status ?? "пока пусто",
      state: nodeState(c.medications, pri === "add_medications"),
      icon: "⊕", size: "md",
    },
    {
      key: "symptoms", label: "Симптомы", href: "/symptoms-map",
      status: symptomsMod?.status ?? "пока пусто",
      state: nodeState(c.symptoms, false),
      icon: "◎", size: "sm",
    },
    {
      key: "lifestyle", label: "Образ жизни", href: "/timeline",
      status: c.diary > 0 ? "есть записи" : "пока пусто",
      state: c.diary > 0 ? "active" : "empty",
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
  for (const cor of mco.correlations.slice(0, 2)) {
    const fromNode = corKeyToNode[cor.from];
    const toNode = corKeyToNode[cor.to];
    if (fromNode) relatedNodes.add(fromNode);
    if (toNode) relatedNodes.add(toNode);
  }
  const RELATION_GLOW = "0 0 32px rgba(45,212,191,0.12)";
  function nodeGlow(baseGlow: string, isRelated: boolean): string {
    if (!isRelated) return baseGlow;
    if (baseGlow === "none") return RELATION_GLOW;
    return `${baseGlow}, ${RELATION_GLOW}`;
  }

  const stateStyles: Record<MapNode["state"], { bg: string; border: string; glow: string; icon: string; label: string; status: string }> = {
    empty: {
      bg: "rgba(255,255,255,0.02)",
      border: "1px solid var(--border)",
      glow: "none",
      icon: "var(--text-muted)",
      label: "var(--text-muted)",
      status: "var(--text-muted)",
    },
    active: {
      bg: "var(--bg-surface)",
      border: "1px solid rgba(45,212,191,0.15)",
      glow: "0 0 24px rgba(45,212,191,0.08)",
      icon: "var(--accent)",
      label: "var(--text-primary)",
      status: "var(--accent)",
    },
    attention: {
      bg: "var(--bg-surface)",
      border: "1px solid rgba(245,158,11,0.25)",
      glow: "0 0 28px rgba(245,158,11,0.1)",
      icon: "var(--amber)",
      label: "var(--text-primary)",
      status: "var(--amber)",
    },
  };

  return (
    <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
      {process.env.NODE_ENV !== "production" && <ReviewReset />}
      <FirstArrivalOverlay show={isFirstArrival} />

      {/* ===== AGENT ZONE — dominant top presence ===== */}
      <section
        data-hero
        className="relative"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 70% 60% at 50% 20%, rgba(45,212,191,0.04) 0%, transparent 70%)",
          }}
        />

        <div className="relative px-5 sm:px-8 pt-8 sm:pt-10 pb-6 sm:pb-8">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--accent)", opacity: 0.7 }}
          >
            Твой помощник
          </p>
          <p
            className="mt-3 text-[22px] sm:text-[28px] lg:text-[32px] font-bold leading-[1.2]"
            style={{ color: "var(--text-primary)" }}
          >
            {agentOpening}
          </p>
          <p
            className="mt-3 text-[15px] sm:text-[16px] leading-relaxed max-w-2xl"
            style={{ color: "var(--text-muted)" }}
          >
            {agentObservation}
          </p>

          {mco.open_questions.length > 0 && (
            <p className="mt-2 text-[12px]" style={{ color: "var(--text-muted)", opacity: 0.65 }}>
              <span className="font-medium">Открытый вопрос:</span> {mco.open_questions[0]}
            </p>
          )}

          {mco.recent_patterns.length > 0 && (
            <p className="mt-2 text-[12px]" style={{ color: "var(--accent)", opacity: 0.75 }}>
              <span className="font-medium">Что уже вижу:</span> {mco.recent_patterns[0]}
            </p>
          )}

          {/* Evidence tags */}
          {evidence.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {evidence.map((e) => (
                <Link
                  key={e.label}
                  href={e.href}
                  className="rounded-full px-3 py-1 text-[11px] font-medium transition hover:brightness-125"
                  style={{
                    backgroundColor: "rgba(45,212,191,0.08)",
                    color: "var(--accent)",
                    border: "1px solid rgba(45,212,191,0.12)",
                  }}
                >
                  {e.label} · {e.detail}
                </Link>
              ))}
            </div>
          )}

          {unlockMessage && (
            <div className="mt-3">
              <AgentHint label="↑" text={unlockMessage} variant="unlock" />
            </div>
          )}

          {sectionNudges.length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              {sectionNudges.map((n) => (
                <AgentHint key={n.href} label="→" text={n.text} href={n.href} variant="accent" />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== CORRELATIONS STRIP — agent signal ===== */}
      {mco.correlations.length > 0 && (() => {
        const layerLabel: Record<string, string> = {
          diary: "Дневник", vitals: "Показатели", documents: "Документы",
          medications: "Лекарства", emotions: "Эмоции", symptoms: "Симптомы",
        };
        return (
          <div className="px-5 sm:px-8 pt-3 pb-1 flex flex-col gap-2">
            {mco.correlations.slice(0, 2).map((cor) => (
              <div key={`${cor.from}-${cor.to}`} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: "rgba(45,212,191,0.10)", color: "var(--accent)" }}
                  >
                    {layerLabel[cor.from] ?? cor.from}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>·</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: "rgba(45,212,191,0.10)", color: "var(--accent)" }}
                  >
                    {layerLabel[cor.to] ?? cor.to}
                  </span>
                </div>
                <p className="text-[11px] sm:text-[12px] leading-snug" style={{ color: "var(--text-muted)" }}>
                  {cor.description}
                </p>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ===== HEALTH MAP — node composition ===== */}
      <div className="px-4 sm:px-6 pt-5 sm:pt-6">
        {mapHelper && (
          <p className="mb-3 px-1 text-[11px]" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
            {mapHelper}
          </p>
        )}
        <div
          className="grid gap-2.5"
          style={{
            gridTemplateColumns: "1fr 1fr 1fr",
            gridTemplateRows: "auto auto auto",
          }}
        >
          {/* Row 1: Самочувствие (2 cols, large) + Цифры */}
          {(() => {
            const wb = nodes[0];
            const ws = stateStyles[wb.state];
            const isRelated = relatedNodes.has(wb.key);
            return (
              <Link
                key={wb.key}
                href={wb.href}
                className="relative col-span-2 flex items-center gap-4 rounded-2xl px-5 py-5 transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ backgroundColor: ws.bg, border: ws.border, boxShadow: nodeGlow(ws.glow, isRelated) }}
              >
                {isRelated && <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--accent)", opacity: 0.7 }} />}
                <span className="text-3xl" style={{ color: ws.icon }}>{wb.icon}</span>
                <div>
                  <span className="text-[15px] font-bold" style={{ color: ws.label }}>{wb.label}</span>
                  <span className="block text-[12px] mt-0.5" style={{ color: ws.status, opacity: wb.state === "empty" ? 0.6 : 1 }}>{wb.status}</span>
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
                className="relative flex flex-col items-center justify-center text-center rounded-2xl px-2 py-4 transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ backgroundColor: ns.bg, border: ns.border, boxShadow: nodeGlow(ns.glow, isRelated) }}
              >
                {isRelated && <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--accent)", opacity: 0.7 }} />}
                <span className="text-2xl" style={{ color: ns.icon }}>{nd.icon}</span>
                <span className="mt-1.5 text-[12px] font-semibold" style={{ color: ns.label }}>{nd.label}</span>
                <span className="mt-0.5 text-[10px]" style={{ color: ns.status, opacity: nd.state === "empty" ? 0.6 : 1 }}>{nd.status}</span>
              </Link>
            );
          })()}

          {/* Row 2: Документы + Лекарства + Симптомы (equal) */}
          {nodes.slice(2, 5).map((node) => {
            const s = stateStyles[node.state];
            const isRelated = relatedNodes.has(node.key);
            return (
              <Link
                key={node.key}
                href={node.href}
                className="relative flex flex-col items-center justify-center text-center rounded-2xl px-2 py-4 transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ backgroundColor: s.bg, border: s.border, boxShadow: nodeGlow(s.glow, isRelated) }}
              >
                {isRelated && <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--accent)", opacity: 0.7 }} />}
                <span className="text-xl" style={{ color: s.icon }}>{node.icon}</span>
                <span className="mt-1.5 text-[12px] font-semibold leading-tight" style={{ color: s.label }}>{node.label}</span>
                <span className="mt-0.5 text-[10px]" style={{ color: s.status, opacity: node.state === "empty" ? 0.6 : 1 }}>{node.status}</span>
              </Link>
            );
          })}

          {/* Row 3: Образ жизни (spans 3 cols, thin horizontal bar) */}
          {(() => {
            const lf = nodes[5];
            const ls = stateStyles[lf.state];
            return (
              <Link
                key={lf.key}
                href={lf.href}
                className="col-span-3 flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ backgroundColor: ls.bg, border: ls.border, boxShadow: ls.glow }}
              >
                <span className="text-base" style={{ color: ls.icon }}>{lf.icon}</span>
                <span className="text-[12px] font-semibold" style={{ color: ls.label }}>{lf.label}</span>
                <span className="text-[11px] ml-auto" style={{ color: ls.status, opacity: lf.state === "empty" ? 0.6 : 1 }}>{lf.status}</span>
              </Link>
            );
          })()}
        </div>

        {/* ===== PRIORITY ACTION — agent's next step ===== */}
        <Link
          href={agentNextStep.href}
          className="mt-5 flex items-center gap-4 rounded-2xl px-5 py-4 transition-all hover:brightness-110 active:scale-[0.99]"
          style={{
            backgroundColor: "var(--accent-muted)",
            border: "1px solid rgba(45,212,191,0.15)",
          }}
        >
          <span
            className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold"
            style={{ backgroundColor: "rgba(45,212,191,0.15)", color: "var(--accent)" }}
          >
            →
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] sm:text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {agentNextStep.text}
            </p>
            <p className="mt-0.5 text-[12px] sm:text-[13px]" style={{ color: "var(--text-muted)" }}>
              {agentNextStep.sub}
            </p>
            {mco.pending_nudges.length > 1 && (
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                {mco.pending_nudges[1]}
              </p>
            )}
          </div>
          <span className="shrink-0 text-sm font-medium" style={{ color: "var(--accent)" }}>→</span>
        </Link>
      </div>
    </div>
  );
}
