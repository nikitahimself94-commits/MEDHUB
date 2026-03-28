"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getSessionPatient } from "@/lib/get-patient-id";
import { logAiUsage } from "@/lib/log-ai-usage";
import { checkAiQuota } from "@/lib/check-ai-quota";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

async function buildPlanContext(
  sb: SupabaseClient,
  patientId: string
): Promise<string> {
  const [
    { data: profile },
    { data: diary },
    { data: vitals },
    { data: meds },
    { data: parses },
  ] = await Promise.all([
    sb.from("profiles").select("display_name, onboarding_context").eq("patient_id", patientId).limit(1).maybeSingle(),
    sb.from("diary_entries").select("created_at, wellbeing_score, symptoms, pain_score, sleep_hours, notes").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(7),
    sb.from("vitals").select("vital_type, value, unit, measured_at").eq("patient_id", patientId).order("measured_at", { ascending: false }).limit(10),
    sb.from("medications").select("name, dosage, schedule").eq("patient_id", patientId).eq("active", true).limit(10),
    sb.from("document_parses").select("doc_type, key_findings, summary").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(3),
  ]);

  const sections: string[] = [];

  if (profile) {
    sections.push(`Пациент: ${profile.display_name || "не указано"}`);
    if (profile.onboarding_context && typeof profile.onboarding_context === "object") {
      const ctx = profile.onboarding_context as Record<string, string>;
      const ctxParts = Object.entries(ctx).map(([k, v]) => `${k}: ${v}`).join("; ");
      if (ctxParts) sections.push(`Контекст: ${ctxParts}`);
    }
  }

  if (meds?.length) {
    const medList = meds.map((m: { name: string; dosage: string; schedule: string }) =>
      `- ${m.name} ${m.dosage} (${m.schedule})`
    ).join("\n");
    sections.push("АКТИВНЫЕ ЛЕКАРСТВА (пациент принимает сейчас):\n" + medList);
  }

  if (vitals?.length) {
    const vList = vitals.map((v: { vital_type: string; value: string; unit: string; measured_at: string }) =>
      `- ${v.vital_type}: ${v.value} ${v.unit} (${new Date(v.measured_at).toLocaleDateString("ru-RU")})`
    ).join("\n");
    sections.push("Последние показатели:\n" + vList);
  }

  if (diary?.length) {
    const dList = diary.map((d: { created_at: string; wellbeing_score: number; symptoms: string[]; pain_score: number | null; sleep_hours: number | null; notes: string | null }) => {
      const date = new Date(d.created_at).toLocaleDateString("ru-RU");
      const parts = [`${date}: самочувствие ${d.wellbeing_score}/10`];
      if (d.symptoms?.length) parts.push(`симптомы: ${d.symptoms.join(", ")}`);
      if (d.pain_score) parts.push(`боль: ${d.pain_score}/10`);
      if (d.sleep_hours) parts.push(`сон: ${d.sleep_hours}ч`);
      if (d.notes) parts.push(`заметка: ${d.notes}`);
      return "- " + parts.join(", ");
    }).join("\n");
    sections.push("Последние записи дневника:\n" + dList);
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

export async function generateHealthPlan(): Promise<string> {
  const { userId, patientId, supabase } = await getSessionPatient();

  await checkAiQuota(supabase as unknown as SupabaseClient, patientId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY не настроен");

  const context = await buildPlanContext(
    supabase as unknown as SupabaseClient,
    patientId
  );

  const systemPrompt = `Ты — AI-ассистент в приложении MedHUB. Твоя задача — составить план наблюдения за здоровьем на ближайшие 2 недели на основе данных пациента.

Ответ должен быть на русском языке в формате markdown с обязательными разделами:

## Что я сейчас вижу
Краткая сводка текущего состояния по имеющимся данным в 3-5 предложениях. Ссылайся на конкретные цифры и записи.

## На что обратить внимание в ближайшие 2 недели
Конкретные сигналы из данных, которые стоит отслеживать. Если видишь тенденции или повторяющиеся паттерны — укажи их.

## Что стоит отслеживать
Какие показатели и симптомы логировать регулярно. Дай конкретные рекомендации: что записывать, как часто.

## Какие данные ещё нужно добавить
Что не хватает в MedHUB для более полного анализа. Какие модули приложения ещё не заполнены.

## Что обсудить с врачом
3-5 конкретных вопросов для обсуждения с врачом, основанных на имеющихся данных.

Правила содержания:
- НЕ ставь диагнозы и НЕ утверждай наличие заболеваний
- НЕ назначай лечение и НЕ рекомендуй конкретные препараты
- Это план наблюдения, не медицинское заключение
- Будь конкретным — ссылайся на реальные данные пациента
- Если данных мало — честно скажи об этом в каждом разделе
- Пиши простым языком, понятным пациенту
- Если в данных указаны активные лекарства — ОБЯЗАТЕЛЬНО упомяни их в разделе "Что я сейчас вижу". НЕ пиши что данных о лекарствах нет, если они перечислены в контексте

Правила форматирования (СТРОГО):
- Используй ТОЛЬКО: заголовки ## (второго уровня), маркированные списки (- ), нумерованные списки (1.), обычные параграфы и жирный текст (**текст**)
- НЕ используй эмодзи
- НЕ используй таблицы (| ... | ... |)
- НЕ используй блок-цитаты (> ...)
- НЕ используй горизонтальные линии (---)
- НЕ используй заголовки # или ### — только ##
- НЕ добавляй вводный заголовок или подзаголовок перед первым разделом — начинай сразу с ## Что я сейчас вижу`;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: `Составь план наблюдения за здоровьем на основе этих данных:\n\n${context}` }],
  });

  logAiUsage({
    supabase: supabase as unknown as SupabaseClient,
    patientId, userId, feature: "health_summary",
    model: "claude-sonnet-4-6",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const rawText =
    response.content[0]?.type === "text"
      ? response.content[0].text
      : null;

  if (!rawText) throw new Error("Не удалось получить ответ от AI");

  revalidatePath("/ai-plan");

  return rawText;
}
