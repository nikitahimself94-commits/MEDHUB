"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionPatient } from "@/lib/get-patient-id";
import { checkAiQuota } from "@/lib/check-ai-quota";
import { logAiUsage } from "@/lib/log-ai-usage";
import { revalidatePath } from "next/cache";

// ============================================================
// TYPES (exported for test script)
// ============================================================

export interface HypothesisResult {
  ok: true;
  hypothesisId: string;
  status: string;
}

export interface HypothesisBlocked {
  ok: false;
  reason: "no_concern" | "not_enough_data" | "already_exists" | "ai_quota" | "generation_failed";
}

export type GenerateResult = HypothesisResult | HypothesisBlocked;

export interface CoreParams {
  supabase: SupabaseClient;
  patientId: string;
  concernId: string;
  userId: string;
}

interface Signal {
  signal: string;
  domain: string;
}

interface MissingSignal {
  signal: string;
  domain: string;
  target_href: string;
}

interface HypothesisOutput {
  statement: string;
  status: "emerging" | "plausible" | "supported" | "weakened" | "deprioritized" | "unresolved" | "urgent review needed";
  confidence_level: "low" | "medium" | "high";
  supporting: Signal[];
  weakening: Signal[];
  missing: MissingSignal[];
  next_step: { text: string; reason: string; domain: string; href: string };
  contributing_domains: string[];
}

// ============================================================
// DOMAIN HREF MAP
// ============================================================

const DOMAIN_HREFS: Record<string, string> = {
  symptoms: "/diary",
  vitals: "/vitals",
  medications: "/medications",
  documents: "/documents",
  timeline: "/timeline",
  baseline: "/profile",
  wellbeing: "/diary",
  lifestyle: "/timeline",
  emotions: "/emotions",
  triggers: "/diary",
};

// ============================================================
// SANITIZATION
// ============================================================

const VALID_DOMAINS = new Set(Object.keys(DOMAIN_HREFS));

const DOMAIN_ALIASES: Record<string, string> = {
  cardiovascular: "vitals", blood_pressure: "vitals", pressure: "vitals",
  diary: "symptoms", sleep: "lifestyle", stress: "emotions",
  lab: "documents", labs: "documents", analysis: "documents",
  meds: "medications", drugs: "medications", anamnesis: "baseline",
  profile: "baseline", history: "timeline", events: "timeline",
  food: "triggers", diet: "triggers",
};

function sanitizeDomain(raw: string): string | null {
  const lower = raw.toLowerCase().trim();
  if (VALID_DOMAINS.has(lower)) return lower;
  if (DOMAIN_ALIASES[lower]) return DOMAIN_ALIASES[lower];
  return null;
}

// href is ALWAYS determined by domain — model output ignored
function hrefForDomain(domain: string): string {
  return DOMAIN_HREFS[domain] || "/diary";
}

// ============================================================
// CORE DOMAIN COUNT
// ============================================================

async function countCoreDomains(
  supabase: SupabaseClient,
  patientId: string,
): Promise<{ count: number; domains: string[] }> {
  const [
    { count: diaryCount },
    { count: vitalsCount },
    { count: medsCount },
    { count: docsCount },
    { count: timelineCount },
    { data: medProfile },
  ] = await Promise.all([
    supabase.from("diary_entries").select("id", { count: "exact", head: true }).eq("patient_id", patientId),
    supabase.from("vitals").select("id", { count: "exact", head: true }).eq("patient_id", patientId),
    supabase.from("medications").select("id", { count: "exact", head: true }).eq("patient_id", patientId).eq("active", true),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("patient_id", patientId),
    supabase.from("timeline_events").select("id", { count: "exact", head: true }).eq("patient_id", patientId),
    supabase.from("medical_profile").select("blood_type, allergies, chronic_conditions").eq("patient_id", patientId).maybeSingle(),
  ]);

  const domains: string[] = [];
  if ((diaryCount ?? 0) > 0) domains.push("symptoms");
  if ((vitalsCount ?? 0) > 0) domains.push("vitals");
  if ((medsCount ?? 0) > 0) domains.push("medications");
  if ((docsCount ?? 0) > 0) domains.push("documents");
  if ((timelineCount ?? 0) > 0) domains.push("timeline");
  if (medProfile?.blood_type || medProfile?.allergies || medProfile?.chronic_conditions) domains.push("baseline");

  return { count: domains.length, domains };
}

// ============================================================
// DATA BUNDLE
// ============================================================

// ============================================================
// CONCERN EVIDENCE CHECK — shared between generation and dashboard
// ============================================================

export interface ConcernEvidenceMeta {
  usedConcernData: boolean;
  diary: number;
  vitals: number;
  documents: number;
}

/** Same selection logic as buildDataBundle: concern-bound queries with identical limits */
export async function getConcernEvidenceMeta(
  supabase: SupabaseClient,
  patientId: string,
  concernId: string,
): Promise<ConcernEvidenceMeta> {
  const [{ data: cd }, { data: cv }, { data: cdoc }] = await Promise.all([
    supabase.from("diary_entries").select("id").eq("patient_id", patientId).eq("concern_id", concernId).limit(10),
    supabase.from("vitals").select("id").eq("patient_id", patientId).eq("concern_id", concernId).limit(15),
    supabase.from("documents").select("id").eq("patient_id", patientId).eq("concern_id", concernId).limit(5),
  ]);
  const diary = cd?.length ?? 0;
  const vitals = cv?.length ?? 0;
  const documents = cdoc?.length ?? 0;
  return { usedConcernData: diary + vitals + documents > 0, diary, vitals, documents };
}

// ============================================================
// MEANINGFUL-DELTA STALE DETECTION
// ============================================================

export interface StaleMeta {
  isStale: boolean;
  reasons: string[];
}

/**
 * Checks if hypothesis is stale by looking for new relevant data after hypothesis.updated_at.
 * Concern-bound data checked first; falls back to patient-wide if no concern-bound data exists.
 */
export async function getHypothesisStaleMeta(
  supabase: SupabaseClient,
  patientId: string,
  concernId: string,
  hypothesisUpdatedAt: string,
  concernUpdatedAt: string | null,
): Promise<StaleMeta> {
  const hypTs = hypothesisUpdatedAt;
  const reasons: string[] = [];

  // 1. Concern itself changed
  if (concernUpdatedAt && new Date(concernUpdatedAt).getTime() > new Date(hypTs).getTime()) {
    reasons.push("Цель наблюдения изменена");
  }

  // 2. Check concern-bound data first (diary/vitals/documents)
  const [{ data: cbDiary }, { data: cbVitals }, { data: cbDocs }] = await Promise.all([
    supabase.from("diary_entries").select("id").eq("patient_id", patientId).eq("concern_id", concernId).gt("created_at", hypTs).limit(1),
    supabase.from("vitals").select("id").eq("patient_id", patientId).eq("concern_id", concernId).gt("measured_at", hypTs).limit(1),
    supabase.from("documents").select("id").eq("patient_id", patientId).eq("concern_id", concernId).gt("created_at", hypTs).limit(1),
  ]);

  const hasConcernBound = (cbDiary?.length ?? 0) + (cbVitals?.length ?? 0) + (cbDocs?.length ?? 0) > 0;

  if (hasConcernBound) {
    if (cbDiary?.length) reasons.push("Новые записи по задаче");
    if (cbVitals?.length) reasons.push("Новые показатели по задаче");
    if (cbDocs?.length) reasons.push("Новые документы по задаче");
  } else {
    // 3. Fallback: patient-wide for diary/vitals/documents
    const [{ data: pwDiary }, { data: pwVitals }, { data: pwDocs }] = await Promise.all([
      supabase.from("diary_entries").select("id").eq("patient_id", patientId).gt("created_at", hypTs).limit(1),
      supabase.from("vitals").select("id").eq("patient_id", patientId).gt("measured_at", hypTs).limit(1),
      supabase.from("documents").select("id").eq("patient_id", patientId).gt("created_at", hypTs).limit(1),
    ]);
    if (pwDiary?.length) reasons.push("Новые записи в дневнике");
    if (pwVitals?.length) reasons.push("Новые показатели");
    if (pwDocs?.length) reasons.push("Новые документы");
  }

  // 4. Patient-wide domains (not concern-bound)
  const [{ data: newMeds }, { data: newIntakes }, { data: newEmotions }, { data: newTimeline }] = await Promise.all([
    supabase.from("medications").select("id").eq("patient_id", patientId).eq("active", true).gt("created_at", hypTs).limit(1),
    supabase.from("medication_intakes").select("id").eq("patient_id", patientId).gt("taken_at", hypTs).limit(1),
    supabase.from("emotion_entries").select("id").eq("patient_id", patientId).gt("created_at", hypTs).limit(1),
    supabase.from("timeline_events").select("id").eq("patient_id", patientId).gt("created_at", hypTs).limit(1),
  ]);
  if (newMeds?.length) reasons.push("Изменения в терапии");
  if (newIntakes?.length) reasons.push("Новые приёмы лекарств");
  if (newEmotions?.length) reasons.push("Новые эмоц. записи");
  if (newTimeline?.length) reasons.push("Новые события хронологии");

  reasons.splice(3);
  return { isStale: reasons.length > 0, reasons };
}

interface DataBundleResult {
  text: string;
  concernBound: { diary: number; vitals: number; documents: number };
  usedConcernData: boolean;
}

async function buildDataBundle(
  supabase: SupabaseClient,
  patientId: string,
  concernId?: string,
): Promise<DataBundleResult> {
  // Try concern-bound data first for diary/vitals/documents
  let diary: Record<string, unknown>[] | null = null;
  let vitals: Record<string, unknown>[] | null = null;
  let docs: Record<string, unknown>[] | null = null;
  const concernBound = { diary: 0, vitals: 0, documents: 0 };

  if (concernId) {
    const [{ data: cd }, { data: cv }, { data: cdoc }] = await Promise.all([
      supabase.from("diary_entries").select("created_at, wellbeing_score, symptoms, structured_symptoms, lifestyle_context, exposures, pain_score, sleep_hours, notes").eq("patient_id", patientId).eq("concern_id", concernId).order("created_at", { ascending: false }).limit(10),
      supabase.from("vitals").select("vital_type, value, unit, measured_at").eq("patient_id", patientId).eq("concern_id", concernId).order("measured_at", { ascending: false }).limit(15),
      supabase.from("documents").select("id, title, category, document_date").eq("patient_id", patientId).eq("concern_id", concernId).order("document_date", { ascending: false }).limit(5),
    ]);
    concernBound.diary = cd?.length ?? 0;
    concernBound.vitals = cv?.length ?? 0;
    concernBound.documents = cdoc?.length ?? 0;
    if (concernBound.diary + concernBound.vitals + concernBound.documents > 0) {
      diary = cd;
      vitals = cv;
      docs = cdoc;
    }
  }

  const usedConcernData = diary !== null;

  // Fallback to patient-wide if no concern-bound data
  const [
    { data: medProfile },
    { data: fallbackDiary },
    { data: fallbackVitals },
    { data: meds },
    { data: fallbackDocs },
    { data: emotions },
    { data: timeline },
    { data: intakes },
  ] = await Promise.all([
    supabase.from("medical_profile").select("blood_type, rh_factor, allergies, chronic_conditions").eq("patient_id", patientId).maybeSingle(),
    diary ? { data: null } : supabase.from("diary_entries").select("created_at, wellbeing_score, symptoms, structured_symptoms, lifestyle_context, exposures, pain_score, sleep_hours, notes").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(5),
    vitals ? { data: null } : supabase.from("vitals").select("vital_type, value, unit, measured_at").eq("patient_id", patientId).order("measured_at", { ascending: false }).limit(10),
    supabase.from("medications").select("name, dosage, schedule, active, purpose, effect, side_effects, therapy_changes").eq("patient_id", patientId).eq("active", true).limit(10),
    docs ? { data: null } : supabase.from("documents").select("id, title, category, document_date").eq("patient_id", patientId).order("document_date", { ascending: false }).limit(5),
    supabase.from("emotion_entries").select("created_at, anxiety, depression, fatigue, hope").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3),
    supabase.from("timeline_events").select("title, event_date, category").eq("patient_id", patientId).order("event_date", { ascending: false }).limit(5),
    supabase.from("medication_intakes").select("taken_at, medications(name)").eq("patient_id", patientId).order("taken_at", { ascending: false }).limit(30),
  ]);

  const finalDiary = diary ?? fallbackDiary;
  const finalVitals = vitals ?? fallbackVitals;
  const finalDocs = docs ?? fallbackDocs;

  // Fetch parsed data for final documents
  const docIds = (finalDocs as Record<string, unknown>[] | null)?.map(d => d.id as string).filter(Boolean) ?? [];
  const parsesMap: Record<string, { doc_type?: string; doc_date?: string; lab_or_clinic?: string; summary?: string; key_findings?: { name: string; value: string; status?: string }[] }> = {};
  if (docIds.length > 0) {
    const { data: parses } = await supabase.from("document_parses").select("document_id, doc_type, doc_date, lab_or_clinic, summary, key_findings").in("document_id", docIds);
    if (parses) {
      for (const p of parses) {
        parsesMap[p.document_id] = p as typeof parsesMap[string];
      }
    }
  }

  const parts: string[] = [];
  if (usedConcernData) {
    parts.push("ИСТОЧНИК ДАННЫХ: привязанные к текущей цели наблюдения");
  }
  if (medProfile) {
    const bp = [];
    if (medProfile.blood_type) bp.push(`Группа крови: ${medProfile.blood_type}${medProfile.rh_factor ? " " + medProfile.rh_factor : ""}`);
    if (medProfile.allergies) bp.push(`Аллергии: ${medProfile.allergies}`);
    if (medProfile.chronic_conditions) bp.push(`Хронические: ${medProfile.chronic_conditions}`);
    if (bp.length) parts.push("АНАМНЕЗ:\n" + bp.join("\n"));
  }
  if (finalDiary?.length) {
    const diaryLines = (finalDiary as Record<string, unknown>[]).map((d: Record<string, unknown>) => {
      const date = (d.created_at as string)?.slice(0, 10);
      let line = `${date}: самочувствие ${d.wellbeing_score}/10`;

      // Structured symptoms as primary, legacy as fallback
      const structured = Array.isArray(d.structured_symptoms) ? (d.structured_symptoms as Record<string, string>[]).filter(s => s.name?.trim()) : [];
      if (structured.length > 0) {
        const symptomDetails = structured.map(s => {
          const parts: string[] = [s.name];
          if (s.intensity) parts.push(`интенсивность: ${s.intensity}`);
          if (s.frequency) parts.push(`частота: ${s.frequency}`);
          if (s.duration_text) parts.push(`длительность: ${s.duration_text}`);
          if (s.triggers) parts.push(`триггеры: ${s.triggers}`);
          if (s.associated_symptoms) parts.push(`сопутств.: ${s.associated_symptoms}`);
          if (s.functional_impact) parts.push(`влияние: ${s.functional_impact}`);
          if (s.started_at_text) parts.push(`начало: ${s.started_at_text}`);
          return parts.join(", ");
        });
        line += `\n  Симптомы: ${symptomDetails.join("; ")}`;
      } else if ((d.symptoms as string[])?.length) {
        line += `, симптомы: ${(d.symptoms as string[]).join(", ")}`;
      }

      if (d.pain_score) line += `, боль: ${d.pain_score}/10`;
      if (d.sleep_hours) line += `, сон: ${d.sleep_hours}ч`;

      // Lifestyle context
      const lc = d.lifestyle_context as Record<string, string> | null;
      if (lc && typeof lc === "object") {
        const lcParts: string[] = [];
        if (lc.activity_text) lcParts.push(`активность: ${lc.activity_text}`);
        if (lc.caffeine_text) lcParts.push(`кофеин: ${lc.caffeine_text}`);
        if (lc.nicotine_text) lcParts.push(`никотин: ${lc.nicotine_text}`);
        if (lc.alcohol_text) lcParts.push(`алкоголь: ${lc.alcohol_text}`);
        if (lc.food_patterns) lcParts.push(`питание: ${lc.food_patterns}`);
        if (lc.work_schedule) lcParts.push(`работа: ${lc.work_schedule}`);
        if (lc.cycle_context) lcParts.push(`цикл: ${lc.cycle_context}`);
        if (lcParts.length > 0) line += `\n  Контекст: ${lcParts.join("; ")}`;
      }

      // Exposures / triggers
      const exps = Array.isArray(d.exposures) ? (d.exposures as Record<string, string>[]).filter(e => e.type?.trim()) : [];
      if (exps.length > 0) {
        line += `\n  Триггеры: ${exps.map(e => e.details ? `${e.type} (${e.details})` : e.type).join("; ")}`;
      }

      if (d.notes) line += ` — ${d.notes}`;
      return line;
    });
    parts.push(`ДНЕВНИК (${usedConcernData ? "по цели наблюдения" : "последние записи"}):\n` + diaryLines.join("\n"));
  }
  if (finalVitals?.length) {
    const vitalsArr = finalVitals as { vital_type: string; value: string; unit: string; measured_at: string }[];

    // Group by vital_type for pattern summary
    const byType: Record<string, typeof vitalsArr> = {};
    for (const v of vitalsArr) {
      (byType[v.vital_type] ??= []).push(v);
    }

    const VITAL_LABELS: Record<string, string> = {
      blood_pressure: "Давление", pulse: "Пульс", temperature: "Температура",
      spo2: "SpO2", weight: "Вес", glucose: "Глюкоза",
    };

    // Pattern summary per type
    const summaryLines: string[] = [];
    for (const [type, readings] of Object.entries(byType)) {
      const label = VITAL_LABELS[type] ?? type;
      const latest = readings[0];
      const count = readings.length;

      if (type === "blood_pressure" && count >= 2) {
        // Parse sys/dia for BP pattern
        const parsed = readings.map(r => {
          const m = r.value.match(/^(\d+)[\/](\d+)$/);
          return m ? { sys: parseInt(m[1]), dia: parseInt(m[2]) } : null;
        }).filter(Boolean) as { sys: number; dia: number }[];
        const elevated = parsed.filter(p => p.sys >= 140 || p.dia >= 90).length;
        const normal = parsed.length - elevated;
        let pattern = `${count} измер., последнее: ${latest.value}`;
        if (elevated > 0 && normal > 0) pattern += `, повышенных: ${elevated} из ${parsed.length}`;
        else if (elevated === parsed.length) pattern += `, все повышенные`;
        else if (normal === parsed.length) pattern += `, все в норме`;
        summaryLines.push(`${label}: ${pattern}`);
      } else if (count >= 2) {
        const values = readings.map(r => parseFloat(r.value)).filter(v => !isNaN(v));
        let pattern = `${count} измер., последнее: ${latest.value}${latest.unit ? " " + latest.unit : ""}`;
        if (values.length >= 2) {
          const min = Math.min(...values);
          const max = Math.max(...values);
          if (min !== max) pattern += `, разброс: ${min}–${max}`;
          else pattern += `, стабильно`;
        }
        summaryLines.push(`${label}: ${pattern}`);
      } else {
        summaryLines.push(`${label}: ${latest.value}${latest.unit ? " " + latest.unit : ""} (1 измер.)`);
      }
    }

    // Raw measurements after summary
    const rawLines = vitalsArr.map(v =>
      `${v.measured_at?.slice(0, 10)}: ${VITAL_LABELS[v.vital_type] ?? v.vital_type} ${v.value}${v.unit ? " " + v.unit : ""}`
    );

    parts.push(`ПОКАЗАТЕЛИ (${usedConcernData ? "по цели наблюдения" : "последние"}):\nПаттерн: ${summaryLines.join("; ")}\nИзмерения:\n${rawLines.join("\n")}`);
  }
  if (meds?.length) {
    parts.push("ЛЕКАРСТВА (активные):\n" + meds.map(m => {
      let line = `${m.name}${m.dosage ? " " + m.dosage : ""}${m.schedule ? ", " + m.schedule : ""}`;
      const details: string[] = [];
      if (m.purpose) details.push(`назначение: ${m.purpose}`);
      if (m.effect) details.push(`эффект: ${m.effect}`);
      if (m.side_effects) details.push(`побочные: ${m.side_effects}`);
      if (m.therapy_changes) details.push(`изменения: ${m.therapy_changes}`);
      if (details.length > 0) line += `\n  ${details.join("; ")}`;
      return line;
    }).join("\n"));
  }
  if (finalDocs?.length) {
    const docLines = (finalDocs as Record<string, unknown>[]).map((d: Record<string, unknown>) => {
      const docId = d.id as string;
      const parse = parsesMap[docId];

      if (parse) {
        // Parsed document — primary source
        let line = `${parse.doc_date ?? (d.document_date as string)?.slice(0, 10) ?? "?"}: ${parse.doc_type ?? d.title}`;
        if (parse.lab_or_clinic) line += ` (${parse.lab_or_clinic})`;
        if (parse.summary) line += `\n  Резюме: ${parse.summary}`;
        const findings = Array.isArray(parse.key_findings) ? parse.key_findings.filter(f => f.name) : [];
        if (findings.length > 0) {
          line += `\n  Показатели: ${findings.map(f => `${f.name}: ${f.value}${f.status ? ` [${f.status}]` : ""}`).join("; ")}`;
        }
        return line;
      }

      // Raw fallback — no parse available
      return `${(d.document_date as string)?.slice(0, 10) ?? "?"}: ${d.title} (${d.category ?? "без категории"})`;
    });
    parts.push(`ДОКУМЕНТЫ (${usedConcernData ? "по цели наблюдения" : "последние"}):\n` + docLines.join("\n"));
  }
  if (emotions?.length) {
    const emos = emotions as { created_at: string; anxiety: number; depression: number; calmness: number; fatigue: number; hope: number }[];
    const count = emos.length;
    const latest = emos[0];

    // Pattern detection (threshold: ≥4 out of 5 = elevated/low)
    const summaryParts: string[] = [`${count} зап., последняя: ${latest.created_at?.slice(0, 10)}`];
    const highAnxiety = emos.filter(e => e.anxiety >= 4).length;
    const highFatigue = emos.filter(e => e.fatigue >= 4).length;
    const lowCalm = emos.filter(e => e.calmness <= 2).length;
    const highDepression = emos.filter(e => e.depression >= 4).length;
    const lowHope = emos.filter(e => e.hope <= 2).length;
    if (highAnxiety > count / 2) summaryParts.push(`повторяемо высокая тревога (${highAnxiety}/${count})`);
    if (highFatigue > count / 2) summaryParts.push(`повторяемо высокая усталость (${highFatigue}/${count})`);
    if (lowCalm > count / 2) summaryParts.push(`повторяемо низкое спокойствие (${lowCalm}/${count})`);
    if (highDepression > count / 2) summaryParts.push(`повторяемо высокая подавленность (${highDepression}/${count})`);
    if (lowHope > count / 2) summaryParts.push(`повторяемо низкая надежда (${lowHope}/${count})`);
    if (summaryParts.length === 1) summaryParts.push("без выраженных паттернов");

    const rawLines = emos.map(e =>
      `${e.created_at?.slice(0, 10)}: тревога ${e.anxiety}, подавленность ${e.depression}, спокойствие ${e.calmness}, усталость ${e.fatigue}, надежда ${e.hope}`
    );

    parts.push(`ЭМОЦИИ:\nПаттерн: ${summaryParts.join("; ")}\nЗаписи:\n${rawLines.join("\n")}`);
  }
  if (timeline?.length) {
    const events = timeline as { event_date: string; title: string; category: string | null; notes?: string | null }[];
    const count = events.length;

    const EVENT_LABELS: Record<string, string> = {
      doctor_visit: "визит к врачу", analysis: "анализ", procedure: "процедура",
      hospitalization: "госпитализация", treatment_change: "изменение лечения", other: "другое",
    };

    // Count by type for summary
    const typeCounts: Record<string, number> = {};
    for (const e of events) {
      const t = e.category ?? "other";
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    const typeBreakdown = Object.entries(typeCounts)
      .map(([t, n]) => `${EVENT_LABELS[t] ?? t}: ${n}`)
      .join(", ");

    // Notable recent events
    const notable = ["treatment_change", "hospitalization", "analysis", "doctor_visit"];
    const recentNotable = events.filter(e => notable.includes(e.category ?? "")).slice(0, 2);
    const notableLine = recentNotable.length > 0
      ? `Недавние: ${recentNotable.map(e => `${EVENT_LABELS[e.category ?? "other"] ?? e.category} (${e.event_date?.slice(0, 10)})`).join(", ")}`
      : "";

    const summaryParts = [`${count} событий, ${typeBreakdown}`];
    if (notableLine) summaryParts.push(notableLine);

    const rawLines = events.map(e => {
      let line = `${e.event_date?.slice(0, 10) ?? "?"}: ${e.title} (${EVENT_LABELS[e.category ?? "other"] ?? e.category ?? ""})`;
      if (e.notes) line += ` — ${e.notes}`;
      return line;
    });

    parts.push(`ХРОНОЛОГИЯ:\nПаттерн: ${summaryParts.join("; ")}\nСобытия:\n${rawLines.join("\n")}`);
  }
  if (intakes?.length) {
    const intakeArr = intakes as { taken_at: string; medications: unknown }[];

    // Resolve med names
    const intakeRows = intakeArr.map(i => {
      const med = i.medications as unknown as { name: string } | { name: string }[] | null;
      const name = Array.isArray(med) ? med[0]?.name ?? "?" : med?.name ?? "?";
      return { taken_at: i.taken_at, name };
    });

    const count = intakeRows.length;

    // Count per medication
    const perMed: Record<string, { count: number; latest: string }> = {};
    for (const r of intakeRows) {
      if (!perMed[r.name]) perMed[r.name] = { count: 0, latest: r.taken_at };
      perMed[r.name].count++;
    }

    const medBreakdown = Object.entries(perMed)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, { count: c, latest }]) => `${name}: ${c} приёмов, последний ${latest?.slice(0, 10)}`)
      .join("; ");

    const rawLines = intakeRows.map(r =>
      `${r.taken_at?.slice(0, 16).replace("T", " ")}: ${r.name}`
    );

    parts.push(`ПРИЁМЫ ЛЕКАРСТВ:\nПаттерн: ${count} приёмов, ${medBreakdown}\nЗаписи:\n${rawLines.join("\n")}`);
  }
  return { text: parts.join("\n\n") || "Данных нет.", concernBound, usedConcernData };
}

// ============================================================
// STRUCTURED PROMPT
// ============================================================

function buildPrompt(concernTitle: string, concernQuestion: string, dataBundle: string, availableDomains: string[]): string {
  const domainList = availableDomains.map(d => `${d} (→ ${DOMAIN_HREFS[d] ?? "/diary"})`).join(", ");
  return `Ты — медицинский ассистент MedHUB. Сформулируй ОДНУ рабочую гипотезу.

ЦЕЛЬ НАБЛЮДЕНИЯ: ${concernTitle}
${concernQuestion ? `ВОПРОС ПАЦИЕНТА: ${concernQuestion}` : ""}

ДОСТУПНЫЕ ДОМЕНЫ: ${domainList}

ДАННЫЕ ПАЦИЕНТА:
${dataBundle}

ПРАВИЛА:
1. Одна рабочая гипотеза — направление проверки, не диагноз. Гипотеза должна быть строго про указанную цель наблюдения, а не про всю медкарту.
2. Формулировка: "X может быть связано с Y". Никогда "у вас [заболевание]".
3. Данные, помеченные "по цели наблюдения", приоритетнее общих данных пациента.
4. Status: emerging | plausible | supported | weakened | deprioritized | unresolved | urgent review needed.
5. Все domain СТРОГО из: symptoms, vitals, medications, documents, timeline, baseline, wellbeing, lifestyle, emotions, triggers.
6. НЕ указывай href — только domain. Маршруты определяются автоматически.

JSON:
{
  "statement": "...",
  "status": "emerging|plausible|supported|weakened|deprioritized|unresolved|urgent review needed",
  "confidence_level": "low|medium|high",
  "supporting": [{"signal": "...", "domain": "..."}],
  "weakening": [{"signal": "...", "domain": "..."}],
  "missing": [{"signal": "...", "domain": "..."}],
  "next_step": {"text": "...", "reason": "...", "domain": "..."}
}

ВАЖНО: в next_step укажи domain (не href). text и domain должны быть про одно и то же действие.
Ответь ТОЛЬКО JSON.`;
}

// ============================================================
// DETERMINISTIC NEXT_STEP FALLBACKS BY DOMAIN
// ============================================================

const NEXT_STEP_TEXT: Record<string, string> = {
  symptoms: "Добавить записи о симптомах",
  vitals: "Добавить показатели",
  medications: "Уточнить лекарства",
  documents: "Загрузить документ",
  timeline: "Добавить событие в хронологию",
  baseline: "Заполнить базовый профиль",
  wellbeing: "Записать самочувствие",
  lifestyle: "Добавить данные об образе жизни",
  emotions: "Отметить эмоциональное состояние",
  triggers: "Зафиксировать возможные триггеры",
};

const NEXT_STEP_REASON: Record<string, string> = {
  symptoms: "Данные о симптомах помогут уточнить гипотезу",
  vitals: "Объективные измерения усилят картину",
  medications: "Терапия может влиять на наблюдаемый паттерн",
  documents: "Анализы и заключения дополнят картину",
  timeline: "Хронология поможет найти связи",
  baseline: "Базовый контекст нужен для анализа",
  wellbeing: "Самочувствие покажет динамику",
  lifestyle: "Образ жизни может быть связан с паттерном",
  emotions: "Эмоциональный фон помогает находить связи",
  triggers: "Триггеры помогут определить причины",
};

// ============================================================
// PARSE + VALIDATE + SANITIZE
// ============================================================

function parseHypothesis(raw: string): HypothesisOutput | null {
  try {
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const obj = JSON.parse(cleaned);

    const validStatuses = ["emerging", "plausible", "supported", "weakened", "deprioritized", "unresolved", "urgent review needed"];
    const validConfidence = ["low", "medium", "high"];
    if (!obj.statement || typeof obj.statement !== "string") return null;
    if (!validStatuses.includes(obj.status)) return null;
    const confidence_level = validConfidence.includes(obj.confidence_level) ? obj.confidence_level as "low" | "medium" | "high" : "low";
    if (!Array.isArray(obj.supporting)) return null;
    if (!Array.isArray(obj.missing)) return null;
    if (!obj.next_step?.text) return null;

    const supporting: Signal[] = (obj.supporting as Record<string, string>[])
      .map((s) => { const d = sanitizeDomain(s.domain || ""); return d && s.signal ? { signal: s.signal, domain: d } : null; })
      .filter((s): s is Signal => s !== null)
      .slice(0, 4);

    const weakening: Signal[] = ((obj.weakening ?? []) as Record<string, string>[])
      .map((s) => { const d = sanitizeDomain(s.domain || ""); return d && s.signal ? { signal: s.signal, domain: d } : null; })
      .filter((s): s is Signal => s !== null)
      .slice(0, 3);

    const missing: MissingSignal[] = (obj.missing as Record<string, string>[])
      .map((m) => { const d = sanitizeDomain(m.domain || ""); return d && m.signal ? { signal: m.signal, domain: d, target_href: hrefForDomain(d) } : null; })
      .filter((m): m is MissingSignal => m !== null)
      .slice(0, 4);

    // Derived from sanitized evidence — model output ignored
    const seen = new Set<string>();
    const contributing_domains: string[] = [];
    for (const s of supporting) { if (!seen.has(s.domain)) { seen.add(s.domain); contributing_domains.push(s.domain); } }
    for (const w of weakening) { if (!seen.has(w.domain)) { seen.add(w.domain); contributing_domains.push(w.domain); } }

    if (supporting.length === 0) return null;

    // Finalize missing with fallback
    const finalMissing = missing.length > 0 ? missing : [{ signal: "Нужно больше данных", domain: "symptoms", target_href: "/diary" }];

    // next_step: domain/href always derived from first missing item
    const primaryMissing = finalMissing[0];
    const nextDomain = primaryMissing.domain;
    const nextHref = hrefForDomain(nextDomain);
    const nextText = (obj.next_step?.text as string) || NEXT_STEP_TEXT[nextDomain] || "Добавить данные";
    const nextReason = (obj.next_step?.reason as string) || NEXT_STEP_REASON[nextDomain] || "Дополнительные данные помогут уточнить гипотезу";

    return {
      statement: obj.statement,
      status: obj.status,
      confidence_level,
      supporting,
      weakening,
      missing: finalMissing,
      next_step: { text: nextText, reason: nextReason, domain: nextDomain, href: nextHref },
      contributing_domains,
    };
  } catch {
    return null;
  }
}

// ============================================================
// INTERNAL PAYLOAD HELPER — generates hypothesis but does NOT write to DB
// ============================================================

interface PayloadParams {
  supabase: SupabaseClient;
  patientId: string;
  userId: string;
  concernId: string;
  concernTitle: string;
  concernQuestion: string;
}

type PayloadResult =
  | { ok: true; payload: HypothesisOutput; meta: { usedConcernData: boolean; concernBound: { diary: number; vitals: number; documents: number } } }
  | { ok: false; reason: HypothesisBlocked["reason"] };

async function generateHypothesisPayload(params: PayloadParams): Promise<PayloadResult> {
  const { supabase, patientId, userId, concernId, concernTitle, concernQuestion } = params;

  // 1. Check core domain count >= 2
  const { count: coreCount, domains: availableDomains } = await countCoreDomains(supabase, patientId);
  if (coreCount < 2) return { ok: false, reason: "not_enough_data" };

  // 2. Check AI quota
  try {
    await checkAiQuota(supabase, patientId);
  } catch {
    return { ok: false, reason: "ai_quota" };
  }

  // 3. Build data bundle and prompt
  const bundleResult = await buildDataBundle(supabase, patientId, concernId);
  const prompt = buildPrompt(concernTitle, concernQuestion, bundleResult.text, availableDomains);

  // 4. Call Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: "generation_failed" };

  const client = new Anthropic({ apiKey });
  let rawText: string;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });
    rawText = response.content[0]?.type === "text" ? response.content[0].text : "";
    inputTokens = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
  } catch {
    return { ok: false, reason: "generation_failed" };
  }

  // 5. Log AI usage
  logAiUsage({
    supabase,
    patientId,
    userId,
    feature: "hypothesis_generation",
    model: "claude-sonnet-4-6",
    inputTokens,
    outputTokens,
  });

  // 6. Parse and validate
  const hypothesis = parseHypothesis(rawText);
  if (!hypothesis) return { ok: false, reason: "generation_failed" };

  return { ok: true, payload: hypothesis, meta: { usedConcernData: bundleResult.usedConcernData, concernBound: bundleResult.concernBound } };
}

// ============================================================
// CORE GENERATION LOGIC — create-only (exported for direct testing)
// ============================================================

export async function generateHypothesisCore(params: CoreParams): Promise<GenerateResult> {
  const { supabase, patientId, concernId, userId } = params;

  // 1. Verify concern exists and belongs to this patient
  const { data: concern } = await supabase
    .from("active_concerns")
    .select("id, title, key_question")
    .eq("id", concernId)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!concern) return { ok: false, reason: "no_concern" };

  // 2. Check hypothesis doesn't already exist
  const { data: existing } = await supabase
    .from("hypotheses")
    .select("id")
    .eq("concern_id", concern.id)
    .maybeSingle();

  if (existing) return { ok: false, reason: "already_exists" };

  // 3. Generate payload (quota, domains, AI call, parse)
  const payloadResult = await generateHypothesisPayload({
    supabase, patientId, userId, concernId,
    concernTitle: concern.title,
    concernQuestion: concern.key_question || "",
  });

  if (!payloadResult.ok) return { ok: false, reason: payloadResult.reason };
  const hypothesis = payloadResult.payload;

  // 4. Insert
  const { data: inserted, error: insertErr } = await supabase
    .from("hypotheses")
    .insert({
      patient_id: patientId,
      concern_id: concern.id,
      statement: hypothesis.statement,
      status: hypothesis.status,
      confidence_level: hypothesis.confidence_level,
      supporting: hypothesis.supporting,
      weakening: hypothesis.weakening,
      missing: hypothesis.missing,
      next_step: hypothesis.next_step,
      contributing_domains: hypothesis.contributing_domains,
    })
    .select("id, status")
    .single();

  if (insertErr || !inserted) return { ok: false, reason: "generation_failed" };

  return { ok: true, hypothesisId: inserted.id, status: inserted.status };
}

// ============================================================
// SESSION WRAPPER (server action for dashboard)
// ============================================================

export async function generateHypothesisForConcern(concernId: string): Promise<GenerateResult> {
  const { userId, patientId, supabase } = await getSessionPatient();
  const result = await generateHypothesisCore({
    supabase: supabase as unknown as SupabaseClient,
    patientId,
    concernId,
    userId,
  });
  if (result.ok) {
    revalidatePath("/dashboard");
  }
  return result;
}

export async function regenerateHypothesisForConcern(concernId: string): Promise<GenerateResult> {
  const { userId, patientId, supabase } = await getSessionPatient();
  const sb = supabase as unknown as SupabaseClient;

  // A. Verify concern belongs to patient
  const { data: concern } = await sb
    .from("active_concerns")
    .select("id, title, key_question")
    .eq("id", concernId)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!concern) return { ok: false, reason: "no_concern" };

  // B. Check if existing hypothesis exists
  const { data: existing } = await sb
    .from("hypotheses")
    .select("id")
    .eq("concern_id", concern.id)
    .maybeSingle();

  if (!existing) {
    // D. No existing hypothesis — normal create path
    const result = await generateHypothesisCore({
      supabase: sb, patientId, concernId, userId,
    });
    if (result.ok) {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/test-hypothesis");
    }
    return result;
  }

  // E. Existing hypothesis — safe regenerate: generate FIRST, update AFTER
  const payloadResult = await generateHypothesisPayload({
    supabase: sb, patientId, userId, concernId,
    concernTitle: concern.title,
    concernQuestion: concern.key_question || "",
  });

  // Generation failed → old hypothesis stays untouched
  if (!payloadResult.ok) return { ok: false, reason: payloadResult.reason };
  const hypothesis = payloadResult.payload;

  // Update existing row in place — preserve id, patient_id, concern_id, created_at
  const { data: updated, error: updateErr } = await sb
    .from("hypotheses")
    .update({
      statement: hypothesis.statement,
      status: hypothesis.status,
      confidence_level: hypothesis.confidence_level,
      supporting: hypothesis.supporting,
      weakening: hypothesis.weakening,
      missing: hypothesis.missing,
      next_step: hypothesis.next_step,
      contributing_domains: hypothesis.contributing_domains,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("id, status")
    .single();

  if (updateErr || !updated) return { ok: false, reason: "generation_failed" };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/test-hypothesis");
  return { ok: true, hypothesisId: updated.id, status: updated.status };
}

export async function clearHypothesisForConcern(concernId: string): Promise<void> {
  const { patientId, supabase } = await getSessionPatient();
  const sb = supabase as unknown as SupabaseClient;

  // Verify concern belongs to patient
  const { data: concern } = await sb
    .from("active_concerns")
    .select("id")
    .eq("id", concernId)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!concern) return;

  // Find existing hypothesis
  const { data: existing } = await sb
    .from("hypotheses")
    .select("id")
    .eq("concern_id", concern.id)
    .maybeSingle();

  if (!existing) return;

  // Delete hypothesis only — concern stays
  const { error } = await sb
    .from("hypotheses")
    .delete()
    .eq("id", existing.id);

  if (error) return;

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/test-hypothesis");
}
