"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionPatient } from "@/lib/get-patient-id";
import { logAiUsage } from "@/lib/log-ai-usage";
import { checkAiQuota } from "@/lib/check-ai-quota";
import { revalidatePath } from "next/cache";

async function buildContextSnapshot(
  supabase: SupabaseClient,
  patientId: string
): Promise<string> {
  const sb = supabase;

  const [
    { data: profile },
    { data: medProfile },
    { data: diary },
    { data: vitals },
    { data: meds },
    { data: docs },
  ] = await Promise.all([
    sb.from("profiles").select("display_name, role").eq("patient_id", patientId).limit(1).maybeSingle(),
    sb.from("medical_profiles").select("blood_type, rh_factor, allergies, chronic_conditions, emergency_info").eq("patient_id", patientId).maybeSingle(),
    sb.from("diary_entries").select("created_at, wellbeing_score, symptoms, pain_score, pain_location, sleep_hours, notes").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(5),
    sb.from("vitals").select("vital_type, value, unit, measured_at").eq("patient_id", patientId).order("measured_at", { ascending: false }).limit(10),
    sb.from("medications").select("name, dosage, schedule, active, notes").eq("patient_id", patientId).eq("active", true).limit(20),
    sb.from("documents").select("title, category, document_date, status, notes").eq("patient_id", patientId).order("document_date", { ascending: false }).limit(5),
  ]);

  const sections: string[] = [];

  if (profile) {
    sections.push(`Пациент: ${profile.display_name || "не указано"}`);

    // Onboarding context from first-step flow (column may not exist yet)
    let ctx: Record<string, string> | null = null;
    {
      const { data: obProfile, error: obErr } = await sb
        .from("profiles")
        .select("onboarding_context")
        .eq("patient_id", patientId)
        .limit(1)
        .maybeSingle();
      if (!obErr) {
        ctx = (obProfile?.onboarding_context as Record<string, string>) ?? null;
      }
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
    const dList = diary.map((d: { created_at: string; wellbeing_score: number; symptoms: string[]; notes: string | null }) => {
      const date = new Date(d.created_at).toLocaleDateString("ru-RU");
      const parts = [`${date}: самочувствие ${d.wellbeing_score}/10`];
      if (d.symptoms?.length) parts.push(`симптомы: ${d.symptoms.join(", ")}`);
      if (d.notes) parts.push(`заметка: ${d.notes}`);
      return "- " + parts.join(", ");
    }).join("\n");
    sections.push("Последние записи дневника:\n" + dList);
  }

  if (docs?.length) {
    const docList = docs.map((d: { title: string; category: string; document_date: string; status: string }) =>
      `- ${d.title} (${d.category}, ${new Date(d.document_date).toLocaleDateString("ru-RU")}, статус: ${d.status})`
    ).join("\n");
    sections.push("Последние документы:\n" + docList);
  }

  return sections.length > 0
    ? sections.join("\n\n")
    : "Данных о пациенте пока нет.";
}

export async function sendMessage(message: string) {
  const { userId, patientId, supabase } = await getSessionPatient();

  if (!message.trim()) throw new Error("Сообщение пустое");

  await checkAiQuota(supabase as unknown as SupabaseClient, patientId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY не настроен");

  // Save user message
  const { error: saveErr } = await supabase.from("ai_chat_messages").insert({
    patient_id: patientId,
    created_by: userId,
    role: "user",
    content: message.trim(),
  });
  if (saveErr) throw new Error(saveErr.message);

  // Load recent chat history for context
  const { data: history } = await supabase
    .from("ai_chat_messages")
    .select("role, content")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true })
    .limit(20);

  const chatMessages = (history ?? []).map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Build context snapshot
  const context = await buildContextSnapshot(supabase as unknown as SupabaseClient, patientId);

  const systemPrompt = `Ты — медицинский ассистент в приложении MedHUB. Отвечай на русском языке.

Твоя роль: помочь пациенту ПОНЯТЬ свои данные, увидеть взаимосвязи и принять осмысленные решения о здоровье. Ты не просто отвечаешь на вопросы — ты думаешь вместе с пациентом.

Как отвечать:
- Говори по-человечески: не медицинским канцеляритом, а понятным разговорным языком
- Опирайся на данные пациента: если есть показатели — ссылайся на них, сравнивай, показывай тренды
- Объясняй СМЫСЛ, а не просто факты: не "ваш пульс 85", а "пульс 85 — это верхняя граница нормы, стоит наблюдать"
- Будь конкретным: вместо "всё в норме" — объясни, что именно в норме и почему это хорошо
- Продолжай диалог: заканчивай ответ уточняющим вопросом или предложением следующего шага, когда это уместно
- Если данных мало — честно скажи, чего не хватает для уверенного ответа, и предложи что добавить

Чего НЕ делать:
- НЕ ставь диагнозы и НЕ назначай лечение
- НЕ отвечай шаблонно "всё в пределах нормы, обратитесь к врачу" — это бесполезно
- НЕ используй таблицы и сложное форматирование — пиши простым текстом с абзацами
- НЕ начинай каждый ответ с "На основании предоставленных данных"
- При серьёзных симптомах — прямо рекомендуй обратиться к врачу, но объясни почему и к какому

Тон: спокойный, конкретный, evidence-first. Ты — ассистент, который опирается на данные. Не изображай врача, не изображай друга. Просто помогай разобраться.

Контекст пациента:
${context}`;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: chatMessages,
  });

  logAiUsage({
    supabase: supabase as unknown as SupabaseClient,
    patientId, userId, feature: "ai_chat",
    model: "claude-sonnet-4-6",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const assistantContent =
    response.content[0]?.type === "text"
      ? response.content[0].text
      : "Не удалось получить ответ.";

  // Save assistant message
  const { error: saveAssistantErr } = await supabase.from("ai_chat_messages").insert({
    patient_id: patientId,
    created_by: null,
    role: "assistant",
    content: assistantContent,
  });
  if (saveAssistantErr) throw new Error(saveAssistantErr.message);

  revalidatePath("/ai-chat");
  revalidatePath("/dashboard");
  return assistantContent;
}
