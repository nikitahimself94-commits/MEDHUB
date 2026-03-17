"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionPatient } from "@/lib/get-patient-id";
import { logAiUsage } from "@/lib/log-ai-usage";
import { checkAiQuota } from "@/lib/check-ai-quota";
import { revalidatePath } from "next/cache";

function parseCommaSeparated(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createDocument(formData: FormData) {
  const { userId, patientId, supabase } = await getSessionPatient();

  const file = formData.get("file") as File | null;
  let fileUrl: string | null = null;
  let fileName: string | null = null;

  if (file && file.size > 0) {
    const ext = file.name.split(".").pop() || "bin";
    const storagePath = `${patientId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file);

    if (uploadError) {
      throw new Error(`Ошибка загрузки файла: ${uploadError.message}`);
    }

    fileUrl = storagePath;
    fileName = file.name;
  }

  const documentDate = formData.get("document_date") as string;
  const category = (formData.get("category") as string) || "";
  const title = formData.get("title") as string;
  const doctor = (formData.get("doctor") as string) || null;
  const lab = (formData.get("lab") as string) || null;
  const status = (formData.get("status") as string) || "normal";
  const tagsRaw = (formData.get("tags") as string) || "";
  const notes = (formData.get("notes") as string) || null;

  const { error } = await supabase.from("documents").insert({
    patient_id: patientId,
    created_by: userId,
    document_date: documentDate,
    category,
    title,
    doctor,
    lab,
    file_url: fileUrl,
    file_name: fileName,
    status,
    tags: parseCommaSeparated(tagsRaw),
    notes,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/documents");
}

export async function deleteDocument(id: string) {
  const { supabase } = await getSessionPatient();

  // Fetch the document to get file_url before deleting
  const { data: doc } = await supabase
    .from("documents")
    .select("file_url")
    .eq("id", id)
    .single();

  if (!doc) {
    throw new Error("Документ не найден");
  }

  // Delete file from storage if it exists
  if (doc.file_url) {
    await supabase.storage.from("documents").remove([doc.file_url]);
    // Intentionally not checking error — file may already be missing
  }

  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/documents");
}

export async function parseDocument(documentId: string) {
  const { userId, patientId, supabase } = await getSessionPatient();

  await checkAiQuota(supabase as unknown as SupabaseClient, patientId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY не настроен");

  // Fetch document record
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("patient_id", patientId)
    .single();

  if (!doc) throw new Error("Документ не найден");
  if (!doc.file_url) throw new Error("У документа нет загруженного файла");

  // Download file from storage
  const { data: fileData, error: dlError } = await supabase.storage
    .from("documents")
    .download(doc.file_url);

  if (dlError || !fileData) throw new Error("Не удалось скачать файл");

  const fileName = doc.file_name || "document";
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // Build content for Claude
  let content: Anthropic.MessageCreateParams["messages"][0]["content"];

  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  const isPdf = ext === "pdf";

  if (isImage) {
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mediaType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    content = [
      {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64 },
      },
      { type: "text", text: "Разбери этот медицинский документ." },
    ];
  } else if (isPdf) {
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = buffer.toString("base64");
    content = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      } as unknown as Anthropic.ContentBlockParam,
      { type: "text", text: "Разбери этот медицинский документ." },
    ];
  } else {
    // Try as text
    const text = await fileData.text();
    if (!text.trim()) throw new Error("Файл пустой или не содержит читаемого текста");
    content = `Разбери этот медицинский документ:\n\n${text}`;
  }

  const systemPrompt = `Ты — медицинский ассистент. Проанализируй документ и верни JSON (без markdown-обёртки) со следующими полями:
{
  "doc_type": "тип документа (анализ крови, УЗИ, заключение врача и т.д.)",
  "doc_date": "дата документа если есть, формат YYYY-MM-DD",
  "lab_or_clinic": "название лаборатории или клиники если указано",
  "key_findings": [{"name": "название показателя", "value": "значение с единицами", "status": "норма/повышен/понижен/внимание"}],
  "summary": "краткое резюме документа на русском, 2-3 предложения"
}
Если какое-то поле невозможно определить — поставь null. В key_findings включи только значимые показатели.`;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content }],
  });

  logAiUsage({
    supabase: supabase as unknown as SupabaseClient,
    patientId, userId, feature: "document_parse",
    model: "claude-sonnet-4-6",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const rawText =
    response.content[0]?.type === "text"
      ? response.content[0].text
      : null;

  if (!rawText) throw new Error("Не удалось получить ответ от AI");

  // Parse JSON from response
  let parsed: {
    doc_type?: string;
    doc_date?: string;
    lab_or_clinic?: string;
    key_findings?: { name: string; value: string; status?: string }[];
    summary?: string;
  };

  try {
    // Strip possible markdown code fences
    const cleaned = rawText.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // If AI didn't return valid JSON, store raw text as summary
    parsed = { summary: rawText };
  }

  // Upsert: delete existing parse for this document, then insert new
  await supabase
    .from("document_parses")
    .delete()
    .eq("document_id", documentId);

  const { error: insertErr } = await supabase.from("document_parses").insert({
    document_id: documentId,
    patient_id: patientId,
    doc_type: parsed.doc_type || null,
    doc_date: parsed.doc_date || null,
    lab_or_clinic: parsed.lab_or_clinic || null,
    key_findings: parsed.key_findings || [],
    summary: parsed.summary || null,
    raw_response: rawText,
  });

  if (insertErr) throw new Error(insertErr.message);

  revalidatePath("/documents");
}

export async function generateSecondOpinion(documentId: string) {
  const { userId, patientId, supabase } = await getSessionPatient();

  await checkAiQuota(supabase as unknown as SupabaseClient, patientId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY не настроен");

  // Fetch document record
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("patient_id", patientId)
    .single();

  if (!doc) throw new Error("Документ не найден");

  // Gather document metadata
  const metaParts: string[] = [];
  metaParts.push(`Название: ${doc.title}`);
  if (doc.category) metaParts.push(`Категория: ${doc.category}`);
  metaParts.push(`Дата: ${new Date(doc.document_date).toLocaleDateString("ru-RU")}`);
  if (doc.doctor) metaParts.push(`Врач: ${doc.doctor}`);
  if (doc.lab) metaParts.push(`Лаборатория/клиника: ${doc.lab}`);
  metaParts.push(`Статус: ${doc.status}`);
  if (doc.notes) metaParts.push(`Заметки: ${doc.notes}`);
  if (doc.tags?.length) metaParts.push(`Теги: ${doc.tags.join(", ")}`);

  // Check for existing AI parse
  const { data: parse } = await supabase
    .from("document_parses")
    .select("doc_type, doc_date, lab_or_clinic, key_findings, summary")
    .eq("document_id", documentId)
    .maybeSingle();

  let parseContext = "";
  if (parse) {
    const parts: string[] = [];
    if (parse.doc_type) parts.push(`Тип: ${parse.doc_type}`);
    if (parse.lab_or_clinic) parts.push(`Лаборатория: ${parse.lab_or_clinic}`);
    if (parse.key_findings?.length) {
      const findings = parse.key_findings.map(
        (f: { name: string; value: string; status?: string }) =>
          `${f.name}: ${f.value}${f.status ? ` (${f.status})` : ""}`
      ).join("; ");
      parts.push(`Показатели: ${findings}`);
    }
    if (parse.summary) parts.push(`Резюме AI-разбора: ${parse.summary}`);
    parseContext = "\n\nРезультат AI-разбора документа:\n" + parts.join("\n");
  }

  // If file exists, try to include its text content
  let fileContent = "";
  if (doc.file_url) {
    try {
      const { data: fileData } = await supabase.storage
        .from("documents")
        .download(doc.file_url);
      if (fileData) {
        const fileName = doc.file_name || "file";
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        if (!["jpg", "jpeg", "png", "gif", "webp", "pdf"].includes(ext)) {
          const text = await fileData.text();
          if (text.trim()) fileContent = "\n\nСодержимое файла:\n" + text;
        }
      }
    } catch {
      // File read optional — continue without it
    }
  }

  const fullContext = "Метаданные документа:\n" + metaParts.join("\n") + parseContext + fileContent;

  const systemPrompt = `Ты — медицинский ассистент в приложении MedHUB. Дай «второе мнение» по медицинскому документу.

Ответ на русском языке в формате markdown с обязательными разделами:

## Что это за документ
Тип, назначение, контекст документа — в 2-3 предложениях.

## На что обратить внимание
Важные находки, отклонения от нормы, тревожные сигналы. Если всё в норме — так и напиши.

## Вопросы для обсуждения с врачом
Список из 3-5 конкретных вопросов, которые стоит задать врачу по этому документу.

## Чего может не хватать
Какие дополнительные данные, анализы или обследования помогли бы лучше интерпретировать результаты.

Правила:
- НЕ ставь диагнозы
- НЕ назначай лечение
- НЕ утверждай, что у пациента точно есть заболевание
- Будь конкретным — ссылайся на данные из документа
- Пиши понятным языком для пациента`;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: `Дай второе мнение по этому документу:\n\n${fullContext}` }],
  });

  logAiUsage({
    supabase: supabase as unknown as SupabaseClient,
    patientId, userId, feature: "document_second_opinion",
    model: "claude-sonnet-4-6",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  const rawText =
    response.content[0]?.type === "text"
      ? response.content[0].text
      : null;

  if (!rawText) throw new Error("Не удалось получить ответ от AI");

  // Upsert: delete existing opinion, then insert new
  await supabase
    .from("document_opinions")
    .delete()
    .eq("document_id", documentId);

  const { error: insertErr } = await supabase.from("document_opinions").insert({
    document_id: documentId,
    patient_id: patientId,
    opinion: rawText,
    raw_response: rawText,
  });

  if (insertErr) throw new Error(insertErr.message);

  revalidatePath("/documents");
}

export async function getSignedFileUrl(storagePath: string): Promise<string> {
  const { supabase } = await getSessionPatient();

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    throw new Error("Не удалось получить ссылку на файл");
  }

  return data.signedUrl;
}
