"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getSessionPatient } from "@/lib/get-patient-id";
import { logAiUsage } from "@/lib/log-ai-usage";
import { checkAiQuota } from "@/lib/check-ai-quota";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

async function buildVisitContext(
  sb: SupabaseClient,
  patientId: string
): Promise<string> {
  const [
    { data: profile },
    { data: medProfile },
    { data: diary },
    { data: vitals },
    { data: meds },
    { data: docs },
    { data: timeline },
    { data: emotions },
    { data: parses },
  ] = await Promise.all([
    sb.from("profiles").select("display_name, role").eq("patient_id", patientId).limit(1).maybeSingle(),
    sb.from("medical_profile").select("blood_type, rh_factor, allergies, chronic_conditions, emergency_info").eq("patient_id", patientId).maybeSingle(),
    sb.from("diary_entries").select("created_at, wellbeing_score, symptoms, pain_score, pain_location, sleep_hours, notes").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(10),
    sb.from("vitals").select("vital_type, value, unit, measured_at").eq("patient_id", patientId).order("measured_at", { ascending: false }).limit(15),
    sb.from("medications").select("name, dosage, schedule, active, notes").eq("patient_id", patientId).eq("active", true).limit(20),
    sb.from("documents").select("title, category, document_date, status, notes").eq("patient_id", patientId).order("document_date", { ascending: false }).limit(10),
    sb.from("timeline_events").select("event_type, event_date, title, notes").eq("patient_id", patientId).order("event_date", { ascending: false }).limit(10),
    sb.from("emotion_entries").select("created_at, anxiety, depression, calmness, fatigue, hope, notes").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(5),
    sb.from("document_parses").select("doc_type, doc_date, lab_or_clinic, key_findings, summary").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(5),
  ]);

  const sections: string[] = [];

  if (profile) {
    sections.push(`Пациент: ${profile.display_name || "не указано"}`);
  }

  if (medProfile) {
    const parts: string[] = [];
    if (medProfile.blood_type) parts.push(`Группа крови: ${medProfile.blood_type}${medProfile.rh_factor || ""}`);
    if (medProfile.chronic_conditions?.length) parts.push(`Хронические: ${medProfile.chronic_conditions.join(", ")}`);
    if (medProfile.allergies?.length) {
      const allergyList = medProfile.allergies.map((a: { name: string }) => a.name).join(", ");
      parts.push(`Аллергии: ${allergyList}`);
    }
    if (medProfile.emergency_info) parts.push(`Экстренная информация: ${medProfile.emergency_info}`);
    if (parts.length) sections.push("Медкарта:\n" + parts.join("\n"));
  }

  if (meds?.length) {
    const medList = meds.map((m: { name: string; dosage: string; schedule: string }) =>
      `- ${m.name} ${m.dosage} (${m.schedule})`
    ).join("\n");
    sections.push("Активные лекарства:\n" + medList);
  }

  if (vitals?.length) {
    const vList = vitals.map((v: { vital_type: string; value: string; unit: string; measured_at: string }) =>
      `- ${v.vital_type}: ${v.value} ${v.unit} (${new Date(v.measured_at).toLocaleDateString("ru-RU")})`
    ).join("\n");
    sections.push("Последние показатели:\n" + vList);
  }

  if (diary?.length) {
    const dList = diary.map((d: { created_at: string; wellbeing_score: number; symptoms: string[]; pain_score: number | null; pain_location: string | null; sleep_hours: number | null; notes: string | null }) => {
      const date = new Date(d.created_at).toLocaleDateString("ru-RU");
      const parts = [`${date}: самочувствие ${d.wellbeing_score}/10`];
      if (d.symptoms?.length) parts.push(`симптомы: ${d.symptoms.join(", ")}`);
      if (d.pain_score) parts.push(`боль: ${d.pain_score}/10${d.pain_location ? ` (${d.pain_location})` : ""}`);
      if (d.sleep_hours) parts.push(`сон: ${d.sleep_hours}ч`);
      if (d.notes) parts.push(`заметка: ${d.notes}`);
      return "- " + parts.join(", ");
    }).join("\n");
    sections.push("Последние записи дневника:\n" + dList);
  }

  if (emotions?.length) {
    const eList = emotions.map((e: { created_at: string; anxiety: number; depression: number; calmness: number; fatigue: number; hope: number; notes: string | null }) => {
      const date = new Date(e.created_at).toLocaleDateString("ru-RU");
      return `- ${date}: тревога ${e.anxiety}/5, подавленность ${e.depression}/5, спокойствие ${e.calmness}/5, усталость ${e.fatigue}/5, надежда ${e.hope}/5${e.notes ? ` (${e.notes})` : ""}`;
    }).join("\n");
    sections.push("Эмоциональное состояние:\n" + eList);
  }

  if (timeline?.length) {
    const tList = timeline.map((t: { event_type: string; event_date: string; title: string; notes: string | null }) =>
      `- ${new Date(t.event_date + "T00:00:00").toLocaleDateString("ru-RU")}: ${t.title} (${t.event_type})${t.notes ? ` — ${t.notes}` : ""}`
    ).join("\n");
    sections.push("Хронология событий:\n" + tList);
  }

  if (docs?.length) {
    const docList = docs.map((d: { title: string; category: string; document_date: string; status: string }) =>
      `- ${d.title} (${d.category}, ${new Date(d.document_date).toLocaleDateString("ru-RU")}, статус: ${d.status})`
    ).join("\n");
    sections.push("Последние документы:\n" + docList);
  }

  if (parses?.length) {
    const pList = parses.map((p: { doc_type: string | null; summary: string | null; key_findings: { name: string; value: string; status?: string }[] }) => {
      const parts: string[] = [];
      if (p.doc_type) parts.push(`Тип: ${p.doc_type}`);
      if (p.key_findings?.length) {
        parts.push("Показатели: " + p.key_findings.map(f => `${f.name}: ${f.value}${f.status ? ` (${f.status})` : ""}`).join("; "));
      }
      if (p.summary) parts.push(`Резюме: ${p.summary}`);
      return "- " + parts.join(". ");
    }).join("\n");
    sections.push("AI-разбор документов:\n" + pList);
  }

  return sections.length > 0
    ? sections.join("\n\n")
    : "Данных о пациенте пока нет.";
}

export async function generateVisitPrep() {
  const { userId, patientId, supabase } = await getSessionPatient();

  await checkAiQuota(supabase as unknown as SupabaseClient, patientId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY не настроен");

  const context = await buildVisitContext(
    supabase as unknown as SupabaseClient,
    patientId
  );

  const systemPrompt = `Ты — медицинский ассистент в приложении MedHUB. На основе данных пациента подготовь структурированную сводку для визита к врачу.

Ответ должен быть на русском языке в формате markdown с обязательными разделами:

## Краткая сводка состояния
Общее описание текущего состояния пациента в 3-5 предложениях.

## Что важно отметить
Изменения, тревожные сигналы или заметные тенденции из последних записей. Если данных мало — так и напиши.

## Текущие лекарства
Список активных препаратов с дозировкой. Если лекарств нет — укажи это.

## Значимые показатели и симптомы
Последние показатели здоровья, повторяющиеся симптомы, результаты анализов. Если есть отклонения — выдели их.

## Вопросы для обсуждения с врачом
Список из 3-7 конкретных вопросов, которые стоит задать врачу на основе имеющихся данных.

Правила:
- НЕ ставь диагнозы и НЕ назначай лечение
- Будь конкретным — ссылайся на реальные данные пациента
- Если данных недостаточно — честно укажи это в каждом разделе
- Пиши простым языком, понятным пациенту`;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: `Подготовь сводку для визита к врачу на основе этих данных:\n\n${context}` }],
  });

  logAiUsage({
    supabase: supabase as unknown as SupabaseClient,
    patientId, userId, feature: "doctor_visit_prep",
    model: "claude-sonnet-4-6",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const rawText =
    response.content[0]?.type === "text"
      ? response.content[0].text
      : null;

  if (!rawText) throw new Error("Не удалось получить ответ от AI");

  const { error } = await supabase.from("doctor_visit_preps").insert({
    patient_id: patientId,
    created_by: userId,
    summary: rawText,
    raw_response: rawText,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/doctor-visit");
}

export async function createShareLink(): Promise<string> {
  const { userId, patientId, supabase } = await getSessionPatient();

  // Revoke any existing active links
  await supabase
    .from("doctor_share_links")
    .update({ status: "revoked" })
    .eq("patient_id", patientId)
    .eq("status", "active");

  // Generate token
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);

  // Expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("doctor_share_links").insert({
    patient_id: patientId,
    created_by: userId,
    token,
    status: "active",
    expires_at: expiresAt,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/doctor-visit");
  return token;
}

export async function revokeShareLink() {
  const { patientId, supabase } = await getSessionPatient();

  const { error } = await supabase
    .from("doctor_share_links")
    .update({ status: "revoked" })
    .eq("patient_id", patientId)
    .eq("status", "active");

  if (error) throw new Error(error.message);

  revalidatePath("/doctor-visit");
}
