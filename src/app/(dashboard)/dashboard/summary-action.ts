"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionPatient } from "@/lib/get-patient-id";
import { logAiUsage } from "@/lib/log-ai-usage";
import { checkAiQuota } from "@/lib/check-ai-quota";

export async function generateHealthSummary(): Promise<string> {
  const { userId, patientId, supabase } = await getSessionPatient();
  const sb = supabase as unknown as SupabaseClient;

  await checkAiQuota(sb, patientId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY не настроен");

  // Gather patient data — same sources as ai-chat context
  const [
    { data: profile },
    { data: medProfile },
    { data: diary },
    { data: vitals },
    { data: meds },
    { data: emotions },
    { data: docs },
  ] = await Promise.all([
    sb.from("profiles").select("display_name").eq("patient_id", patientId).limit(1).maybeSingle(),
    sb.from("medical_profiles").select("blood_type, rh_factor, allergies, chronic_conditions").eq("patient_id", patientId).maybeSingle(),
    sb.from("diary_entries").select("created_at, wellbeing_score, symptoms, pain_score, sleep_hours, notes").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(7),
    sb.from("vitals").select("vital_type, value, unit, measured_at").eq("patient_id", patientId).order("measured_at", { ascending: false }).limit(10),
    sb.from("medications").select("name, dosage, schedule, active").eq("patient_id", patientId).eq("active", true).limit(20),
    sb.from("emotion_entries").select("created_at, anxiety, depression, calmness, fatigue, hope, notes").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(5),
    sb.from("documents").select("title, category, document_date, status").eq("patient_id", patientId).order("document_date", { ascending: false }).limit(5),
  ]);

  // Build context
  const sections: string[] = [];

  if (profile?.display_name) {
    sections.push(`Пациент: ${profile.display_name}`);
  }

  // Onboarding context from first-step flow (column may not exist yet)
  let ctx: Record<string, string> | null = null;
  try {
    const { data: obProfile } = await sb
      .from("profiles")
      .select("onboarding_context")
      .eq("patient_id", patientId)
      .limit(1)
      .maybeSingle();
    ctx = (obProfile?.onboarding_context as Record<string, string>) ?? null;
  } catch {
    // Column doesn't exist yet
  }
  if (ctx && Object.keys(ctx).length > 0) {
    const labels: Record<string, string> = {
      reason: "Причина обращения",
      current_concern: "Текущие жалобы",
      chronic: "Хроническая история",
      documents: "Имеющиеся документы",
      goal: "Цель использования",
    };
    const lines = Object.entries(ctx)
      .filter(([, v]) => v)
      .map(([k, v]) => `${labels[k] || k}: ${v}`);
    if (lines.length > 0) {
      sections.push("Контекст пациента (из знакомства):\n" + lines.join("\n"));
    }
  }

  if (medProfile) {
    const parts: string[] = [];
    if (medProfile.chronic_conditions?.length) parts.push(`Хронические: ${medProfile.chronic_conditions.join(", ")}`);
    if (medProfile.allergies?.length) {
      parts.push(`Аллергии: ${medProfile.allergies.map((a: { name: string }) => a.name).join(", ")}`);
    }
    if (parts.length) sections.push("Медкарта:\n" + parts.join("\n"));
  }

  if (meds?.length) {
    sections.push("Активные лекарства:\n" + meds.map((m: { name: string; dosage: string; schedule: string }) =>
      `- ${m.name} ${m.dosage} (${m.schedule})`
    ).join("\n"));
  }

  if (vitals?.length) {
    sections.push("Последние показатели:\n" + vitals.map((v: { vital_type: string; value: string; unit: string; measured_at: string }) =>
      `- ${v.vital_type}: ${v.value} ${v.unit} (${new Date(v.measured_at).toLocaleDateString("ru-RU")})`
    ).join("\n"));
  }

  if (diary?.length) {
    sections.push("Дневник (последние записи):\n" + diary.map((d: { created_at: string; wellbeing_score: number; symptoms: string[]; pain_score: number | null; sleep_hours: number | null; notes: string | null }) => {
      const date = new Date(d.created_at).toLocaleDateString("ru-RU");
      const parts = [`${date}: самочувствие ${d.wellbeing_score}/10`];
      if (d.symptoms?.length) parts.push(`симптомы: ${d.symptoms.join(", ")}`);
      if (d.pain_score) parts.push(`боль: ${d.pain_score}/10`);
      if (d.sleep_hours) parts.push(`сон: ${d.sleep_hours}ч`);
      if (d.notes) parts.push(`заметка: ${d.notes}`);
      return "- " + parts.join(", ");
    }).join("\n"));
  }

  if (emotions?.length) {
    const emotionLabels: Record<string, string> = {
      anxiety: "тревога", depression: "подавленность", calmness: "спокойствие",
      fatigue: "усталость", hope: "надежда",
    };
    sections.push("Эмоции:\n" + emotions.map((e: { created_at: string; anxiety: number; depression: number; calmness: number; fatigue: number; hope: number; notes: string | null }) => {
      const date = new Date(e.created_at).toLocaleDateString("ru-RU");
      const scores = Object.entries(emotionLabels)
        .map(([key, label]) => `${label}: ${e[key as keyof typeof e]}/5`)
        .join(", ");
      const note = e.notes ? ` (${e.notes})` : "";
      return `- ${date}: ${scores}${note}`;
    }).join("\n"));
  }

  if (docs?.length) {
    sections.push("Документы:\n" + docs.map((d: { title: string; category: string; document_date: string; status: string }) =>
      `- ${d.title} (${d.category}, ${new Date(d.document_date).toLocaleDateString("ru-RU")}, ${d.status})`
    ).join("\n"));
  }

  const context = sections.length > 0 ? sections.join("\n\n") : "";

  // Low-data: return static message without AI call
  const dataPoints = (diary?.length ?? 0) + (vitals?.length ?? 0) + (meds?.length ?? 0) + (docs?.length ?? 0);
  if (dataPoints < 2) {
    return "Пока данных недостаточно для полноценной сводки. Загрузите документ, запишите самочувствие или добавьте показатель — и я смогу дать первые выводы.";
  }

  const systemPrompt = `Ты — медицинский ассистент в приложении MedHUB. Напиши краткую сводку состояния пациента на русском языке.

Формат ответа — ровно 4 коротких абзаца, разделённых пустой строкой:

1. Что я вижу сейчас — конкретные факты из данных. Не просто перечисляй цифры, а дай смысл: что за этими цифрами стоит, какая общая картина складывается.

2. Что из этого главное — выдели 1–2 момента, на которые стоит обратить внимание. Объясни почему: тренд ухудшения, нетипичное значение, взаимосвязь между показателями. Если всё стабильно — скажи это, но объясни, на чём основан вывод.

3. Чего не хватает для уверенности — какие данные дополнили бы картину. Будь конкретным: не "добавьте показатели", а какие именно и зачем. Если данных мало — честно скажи, что пока рано делать выводы, и объясни, что нужно для первой осмысленной аналитики.

4. Полезный следующий шаг — одно конкретное действие, которое пациент может сделать прямо сейчас. Не список из 5 пунктов, а один приоритетный шаг с пояснением, почему именно он.

Правила:
- Каждый абзац — 1–3 предложения, не больше
- Опирайся только на предоставленные данные
- НЕ ставь диагнозы и НЕ назначай лечение
- Если данных мало — честно скажи, без выдумок
- Тон: спокойный, конкретный, уверенный — как надёжный помощник, который думает вместе с пациентом
- Не используй markdown-разметку, заголовки или списки — только простой текст
- Никогда не начинай с фразы "На основании предоставленных данных" — сразу по делу`;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: "user", content: `Данные пациента:\n\n${context}` }],
  });

  logAiUsage({
    supabase: sb,
    patientId,
    userId,
    feature: "health_summary",
    model: "claude-sonnet-4-6",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  return response.content[0]?.type === "text"
    ? response.content[0].text
    : "Не удалось сформировать сводку.";
}
