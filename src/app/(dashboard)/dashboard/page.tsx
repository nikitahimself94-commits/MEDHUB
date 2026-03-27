import Link from "next/link";
import { getSessionPatient } from "@/lib/get-patient-id";
import { getOrRefreshMco } from "@/lib/mco";
import { ServerRotation, type RotationState } from "@/lib/template-rotation";
import { paraphraseHeroOpening } from "@/lib/haiku-paraphrase";
import { OnboardingGate } from "./onboarding-gate";
import { FirstArrivalOverlay } from "./first-arrival-overlay";
import { ReviewReset } from "./review-reset";
import { heroOpening, heroObservation, heroNextStep, heroEvidence } from "./hero-from-mco";
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

  // First arrival: onboarding done (any path) but no product data yet
  const isFirstArrival = onboardingDone && !hasProductData;

  // MCO v1: build or use cached Medical Context Object
  const mco = await getOrRefreshMco(supabase as unknown as SupabaseClient, patientId);

  // --- Hero from MCO + per-user rotation ---
  const rotation = new ServerRotation(rotationState);
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

  return (
    <div>
      {/* DEV-ONLY: ?reset-review clears onboarding + arrival state for re-review */}
      {process.env.NODE_ENV !== "production" && <ReviewReset />}

      {/* First arrival overlay — shows once after onboarding, with delay */}
      <FirstArrivalOverlay show={isFirstArrival} />

      {/* ===== AGENT ZONE — top of Health Map shell ===== */}
      <section
        data-hero
        className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-5"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        {/* Opening + Observation */}
        <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
            Твой помощник
          </p>
          <p className="mt-2.5 text-[20px] sm:text-[22px] font-bold leading-snug" style={{ color: "var(--text-primary)" }}>
            {agentOpening}
          </p>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {agentObservation}
          </p>
        </div>

        {/* Evidence — what agent sees */}
        {evidence.length > 0 && (
          <div
            className="px-5 sm:px-6 py-2 flex flex-wrap gap-x-3 gap-y-0.5"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {evidence.map((e) => (
              <Link
                key={e.label}
                href={e.href}
                className="text-[11px] transition hover:underline"
                style={{ color: "var(--text-muted)" }}
              >
                {e.label} · {e.detail}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ===== HEALTH MAP NODE GRID ===== */}
      {(() => {
        const c = mco.data_completeness;
        const pri = mco.priority_action;

        interface MapNode {
          key: string;
          label: string;
          href: string;
          status: string;
          state: "empty" | "active" | "attention";
          icon: string;
        }

        const diaryMod = modules.find((m) => m.key === "diary");
        const vitalsMod = modules.find((m) => m.key === "vitals");
        const docsMod = modules.find((m) => m.key === "documents");
        const medsMod = modules.find((m) => m.key === "medications");
        const symptomsMod = modules.find((m) => m.key === "symptoms");

        function nodeState(score: number, isPriority: boolean): MapNode["state"] {
          if (isPriority) return "attention";
          if (score > 0) return "active";
          return "empty";
        }

        const nodes: MapNode[] = [
          {
            key: "wellbeing",
            label: "Самочувствие",
            href: "/diary",
            status: diaryMod?.status ?? "пока пусто",
            state: nodeState(Math.max(c.diary, c.emotions), pri === "add_diary" || pri === "update_diary" || pri === "add_emotions"),
            icon: "♡",
          },
          {
            key: "vitals",
            label: "Цифры",
            href: "/vitals",
            status: vitalsMod?.status ?? "пока пусто",
            state: nodeState(c.vitals, pri === "add_vitals"),
            icon: "〜",
          },
          {
            key: "documents",
            label: "Документы",
            href: "/documents",
            status: docsMod?.status ?? "пока пусто",
            state: nodeState(c.documents, pri === "upload_document"),
            icon: "▤",
          },
          {
            key: "medications",
            label: "Лекарства",
            href: "/medications",
            status: medsMod?.status ?? "пока пусто",
            state: nodeState(c.medications, pri === "add_medications"),
            icon: "⊕",
          },
          {
            key: "symptoms",
            label: "Симптомы",
            href: "/symptoms-map",
            status: symptomsMod?.status ?? "пока пусто",
            state: nodeState(c.symptoms, false),
            icon: "◎",
          },
          {
            key: "lifestyle",
            label: "Образ жизни",
            href: "/timeline",
            status: c.diary > 0 ? "есть записи" : "пока пусто",
            state: c.diary > 0 ? "active" : "empty",
            icon: "↻",
          },
        ];

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
            glow: "0 0 20px rgba(45,212,191,0.06)",
            icon: "var(--accent)",
            label: "var(--text-primary)",
            status: "var(--accent)",
          },
          attention: {
            bg: "var(--bg-surface)",
            border: "1px solid rgba(245,158,11,0.2)",
            glow: "0 0 24px rgba(245,158,11,0.08)",
            icon: "var(--amber)",
            label: "var(--text-primary)",
            status: "var(--amber)",
          },
        };

        return (
          <div className="grid grid-cols-3 gap-2">
            {nodes.map((node) => {
              const s = stateStyles[node.state];
              return (
                <Link
                  key={node.key}
                  href={node.href}
                  className="flex flex-col items-center text-center rounded-2xl px-2 py-4 transition-all hover:brightness-110 active:scale-[0.97]"
                  style={{
                    backgroundColor: s.bg,
                    border: s.border,
                    boxShadow: s.glow,
                  }}
                >
                  <span
                    className="text-xl leading-none"
                    style={{ color: s.icon }}
                  >
                    {node.icon}
                  </span>
                  <span
                    className="mt-2 text-[12px] font-semibold leading-tight"
                    style={{ color: s.label }}
                  >
                    {node.label}
                  </span>
                  <span
                    className="mt-0.5 text-[10px] leading-snug"
                    style={{ color: s.status, opacity: node.state === "empty" ? 0.6 : 1 }}
                  >
                    {node.status}
                  </span>
                </Link>
              );
            })}
          </div>
        );
      })()}

      {/* ===== PRIORITY ACTION BAR — bottom of Health Map shell ===== */}
      <Link
        href={agentNextStep.href}
        className="mt-4 flex items-center gap-3 rounded-2xl px-5 py-4 transition-all hover:brightness-110 active:scale-[0.99]"
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid rgba(45,212,191,0.12)",
          boxShadow: "0 0 16px rgba(45,212,191,0.05)",
        }}
      >
        <span
          className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold"
          style={{ backgroundColor: "var(--accent-muted)", color: "var(--accent)" }}
        >
          →
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            {agentNextStep.text}
          </p>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
            {agentNextStep.sub}
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium" style={{ color: "var(--accent)" }}>→</span>
      </Link>

    </div>
  );
}
