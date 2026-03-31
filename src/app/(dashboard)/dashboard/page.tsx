import { getSessionPatient } from "@/lib/get-patient-id";
import { getOrRefreshMco } from "@/lib/mco";
import { getConcernEvidenceMeta, getHypothesisStaleMeta } from "./hypothesis-actions";
import { DataFlowDashboard } from "./data-flow-dashboard";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RealDomainData, ServerMeta, DemoState } from "./data-flow-dashboard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { _state?: string };
}) {
  // Dev-only: allow ?_state=low_data etc. for preview. Ignored in production.
  const validStates: DemoState[] = ["low_data", "concern_no_hypothesis", "emerging", "plausible", "supported", "weakened", "deprioritized", "unresolved", "urgent review needed"];
  const forcedState = process.env.NODE_ENV !== "production" && searchParams._state && validStates.includes(searchParams._state as DemoState)
    ? (searchParams._state as DemoState)
    : undefined;

  const { patientId, supabase } = await getSessionPatient();
  const mco = await getOrRefreshMco(supabase as unknown as SupabaseClient, patientId);

  // Fetch active concern
  const { data: concernRow } = await supabase
    .from("active_concerns")
    .select("id, title, key_question, status, updated_at")
    .eq("patient_id", patientId)
    .maybeSingle();

  const realConcern = concernRow
    ? { name: concernRow.title, question: concernRow.key_question || "", status: concernRow.status ?? "active" }
    : null;
  const concernUpdatedAt: string | null = concernRow?.updated_at ?? null;

  // Linkage counts for active concern
  let concernLinkage = { diary: 0, vitals: 0, documents: 0 };
  if (concernRow) {
    const [{ count: dc }, { count: vc }, { count: docc }] = await Promise.all([
      supabase.from("diary_entries").select("id", { count: "exact", head: true }).eq("concern_id", concernRow.id),
      supabase.from("vitals").select("id", { count: "exact", head: true }).eq("concern_id", concernRow.id),
      supabase.from("documents").select("id", { count: "exact", head: true }).eq("concern_id", concernRow.id),
    ]);
    concernLinkage = { diary: dc ?? 0, vitals: vc ?? 0, documents: docc ?? 0 };
  }

  // Read hypothesis for current concern (if exists)
  let realHypothesis: {
    statement: string;
    status: string;
    confidence_level: string;
    supporting: { signal: string; domain: string }[];
    weakening: { signal: string; domain: string }[];
    missing: { signal: string; domain: string; target_href: string }[];
    next_step: { text: string; reason: string; domain: string; href: string };
    contributing_domains: string[];
    updated_at: string;
  } | null = null;

  if (concernRow) {
    const { data: hypRow } = await supabase
      .from("hypotheses")
      .select("statement, status, confidence_level, supporting, weakening, missing, next_step, contributing_domains, updated_at")
      .eq("concern_id", concernRow.id)
      .maybeSingle();

    if (hypRow && hypRow.statement && hypRow.status) {
      realHypothesis = {
        statement: hypRow.statement,
        status: hypRow.status,
        confidence_level: hypRow.confidence_level ?? "low",
        supporting: Array.isArray(hypRow.supporting) ? hypRow.supporting as { signal: string; domain: string }[] : [],
        weakening: Array.isArray(hypRow.weakening) ? hypRow.weakening as { signal: string; domain: string }[] : [],
        missing: Array.isArray(hypRow.missing) ? hypRow.missing as { signal: string; domain: string; target_href: string }[] : [],
        next_step: hypRow.next_step as { text: string; reason: string; domain: string; href: string },
        contributing_domains: Array.isArray(hypRow.contributing_domains) ? hypRow.contributing_domains : [],
        updated_at: hypRow.updated_at ?? "",
      };
    }
  }

  // Auto state resolution
  const c = mco.data_completeness;
  const hasAnyCoreDomain = c.diary > 0 || c.vitals > 0 || c.documents > 0 || c.medications > 0 || c.symptoms > 0;
  let autoState: DemoState;
  if (!realConcern && !hasAnyCoreDomain) {
    autoState = "low_data";
  } else if (realConcern && realHypothesis) {
    // Use exact hypothesis status — no coercion
    const validHypStatuses: DemoState[] = ["emerging", "plausible", "supported", "weakened", "deprioritized", "unresolved", "urgent review needed"];
    autoState = validHypStatuses.includes(realHypothesis.status as DemoState)
      ? (realHypothesis.status as DemoState)
      : "emerging";
  } else if (realConcern) {
    autoState = "concern_no_hypothesis";
  } else {
    autoState = "low_data";
  }

  // Dev preview overrides auto state; normal dashboard uses auto state
  const demoState = forcedState ?? autoState;

  // Parallel fetch: latest rows + counts for domain cards
  const [
    { data: latestDiary },
    { data: latestVital },
    { count: medsCount },
    { data: latestMed },
    { count: docsCount },
    { data: latestDoc },
    { count: timelineCount },
    { data: latestTimeline },
    { data: latestEmotion },
    { data: medProfile },
  ] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("created_at, wellbeing_score, symptoms")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vitals")
      .select("vital_type, value, unit, measured_at")
      .eq("patient_id", patientId)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("medications")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("active", true),
    supabase
      .from("medications")
      .select("name, created_at")
      .eq("patient_id", patientId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId),
    supabase
      .from("documents")
      .select("title, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("timeline_events")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patientId),
    supabase
      .from("timeline_events")
      .select("created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("emotion_entries")
      .select("created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("medical_profile")
      .select("blood_type, allergies, chronic_conditions")
      .eq("patient_id", patientId)
      .maybeSingle(),
  ]);

  // Helper: relative time string
  function relTime(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return "только что";
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}ч назад`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "вчера";
    if (days < 7) return `${days} дн. назад`;
    return `${Math.floor(days / 7)} нед. назад`;
  }

  // Helper: plural
  function plu(n: number, one: string, few: string, many: string): string {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs >= 11 && abs <= 19) return `${n} ${many}`;
    if (last === 1) return `${n} ${one}`;
    if (last >= 2 && last <= 4) return `${n} ${few}`;
    return `${n} ${many}`;
  }

  // Symptoms status from diary
  const symptomsArr = latestDiary?.symptoms as string[] | null;
  const symptomsStatus = symptomsArr && symptomsArr.length > 0
    ? symptomsArr.slice(0, 2).join(", ")
    : (latestDiary ? "без симптомов" : "нет данных");

  // Vitals status
  const vitalsStatus = latestVital
    ? `${latestVital.vital_type === "blood_pressure" ? "" : latestVital.vital_type + " "}${latestVital.value}${latestVital.unit ? " " + latestVital.unit : ""}`
    : "нет данных";

  // Medications status
  const mc = medsCount ?? 0;
  const medsStatus = mc > 0
    ? plu(mc, "активный", "активных", "активных")
    : "нет данных";

  // Documents status
  const dc = docsCount ?? 0;
  const docsStatus = dc > 0
    ? plu(dc, "файл", "файла", "файлов")
    : "нет данных";

  // Timeline status
  const tc = timelineCount ?? 0;
  const timelineStatus = tc > 0
    ? plu(tc, "событие", "события", "событий")
    : "нет данных";

  // Baseline status
  const hasBaseline = !!(medProfile?.blood_type || medProfile?.allergies || medProfile?.chronic_conditions);
  const baselineFill = hasBaseline ? 0.4 : 0;

  // Wellbeing status
  const wbScore = latestDiary?.wellbeing_score;
  const wellbeingStatus = wbScore != null ? `${wbScore}/10` : "нет данных";

  // Lifestyle — derive from diary sleep data (approximate)
  const lifestyleFill = c.diary > 0 ? Math.min(c.diary * 0.3, 0.3) : 0;

  // Emotions status
  const emotionsStatus = latestEmotion ? "есть записи" : "нет данных";

  const realDomains: RealDomainData = {
    symptoms:    { status: symptomsStatus, updated: relTime(latestDiary?.created_at), fill: c.symptoms },
    vitals:      { status: vitalsStatus, updated: relTime(latestVital?.measured_at), fill: c.vitals },
    medications: { status: medsStatus, updated: relTime(latestMed?.created_at), fill: c.medications },
    documents:   { status: docsStatus, updated: relTime(latestDoc?.created_at), fill: c.documents },
    timeline:    { status: timelineStatus, updated: relTime(latestTimeline?.created_at), fill: Math.min((tc) / 5, 1) },
    baseline:    { status: hasBaseline ? "заполнен" : "нет данных", updated: null, fill: baselineFill },
    wellbeing:   { status: wellbeingStatus, updated: relTime(latestDiary?.created_at), fill: c.diary },
    lifestyle:   { status: lifestyleFill > 0 ? "есть данные" : "нет данных", updated: relTime(latestDiary?.created_at), fill: lifestyleFill },
    emotions:    { status: emotionsStatus, updated: relTime(latestEmotion?.created_at), fill: c.emotions },
    triggers:    { status: "нет данных", updated: null, fill: 0 },
  };

  // ── SERVER META: greeting, observation, next action ──

  const todGreeting: Record<string, string> = {
    morning: "Доброе утро",
    day: "Добрый день",
    evening: "Добрый вечер",
    night: "Доброй ночи",
  };
  const greeting = `${todGreeting[mco.time_of_day] ?? "Добрый день"}, ${mco.name || "пользователь"}.`;

  // Deterministic observation from MCO state + concern context
  const hasAnyData = c.diary > 0 || c.vitals > 0 || c.documents > 0 || c.medications > 0;
  const concernTitle = realConcern?.name ?? null;
  let observation: string;
  if (realHypothesis && concernTitle) {
    // ── REAL HYPOTHESIS MODE: observation driven by lifecycle status ──
    const hypObservations: Record<string, string> = {
      emerging:               `По «${concernTitle}» появилась ранняя рабочая нить. Нужно больше данных, чтобы её подтвердить.`,
      plausible:              `По «${concernTitle}» складывается согласованный паттерн. Стоит уточнить деталями.`,
      supported:              `По «${concernTitle}» есть устойчивая опора. Следующий шаг — проверить или обсудить с врачом.`,
      weakened:               `По «${concernTitle}» появились данные, которые ослабляют текущую гипотезу. Стоит пересмотреть.`,
      deprioritized:          `Гипотеза по «${concernTitle}» отложена. Можно вернуться к ней позже.`,
      unresolved:             `По «${concernTitle}» данных пока недостаточно для вывода. Нужны дополнительные источники.`,
      "urgent review needed": `По «${concernTitle}» требуется срочный пересмотр гипотезы — появились критичные данные.`,
    };
    observation = hypObservations[realHypothesis.status] ?? hypObservations.emerging!;
  } else if (!hasAnyData && !concernTitle) {
    observation = "Для начала укажите, что вас беспокоит, и заполните базовый профиль.";
  } else if (concernTitle && !hasAnyData) {
    observation = `Наблюдение «${concernTitle}» начато. Нужны данные, чтобы начать строить картину.`;
  } else if (concernTitle && hasAnyData) {
    if (mco.days_absent >= 3 && mco.days_absent !== -1) {
      observation = `Наблюдение «${concernTitle}» не обновлялось ${mco.days_absent} дн. Стоит добавить свежие данные.`;
    } else {
      observation = `Собираю данные по «${concernTitle}». Ниже — что уже есть и чего не хватает.`;
    }
  } else if (mco.days_absent >= 3 && mco.days_absent !== -1) {
    observation = `Данные не обновлялись ${mco.days_absent} дн. Стоит зафиксировать текущее состояние.`;
  } else if (mco.recent_patterns.length > 0) {
    observation = mco.recent_patterns[0] + ".";
  } else {
    observation = "Данные обновлены. Создайте цель наблюдения, чтобы начать анализ.";
  }

  // Next action from MCO priority_action — concern-aware reasons when concern exists
  const genericReasons: Record<string, string> = {
    add_diary:        "Дневник — основа для анализа состояния",
    add_vitals:       "Объективные измерения усиливают картину",
    upload_document:  "Анализы и заключения дополнят картину",
    add_medications:  "Терапия влияет на все показатели",
    add_emotions:     "Эмоциональный фон помогает находить связи",
    update_diary:     "Свежие данные улучшают точность анализа",
    none:             "Все данные на месте — проверьте динамику",
  };
  const concernReasons: Record<string, string> = {
    add_diary:        `Поможет отследить динамику по «${concernTitle}»`,
    add_vitals:       `Объективные данные важны для анализа «${concernTitle}»`,
    upload_document:  `Документы усилят картину по «${concernTitle}»`,
    add_medications:  `Терапия может влиять на «${concernTitle}»`,
    add_emotions:     `Эмоциональный фон может быть связан с «${concernTitle}»`,
    update_diary:     `Свежие данные уточнят картину по «${concernTitle}»`,
    none:             "Все данные на месте — проверьте динамику",
  };
  const actionTexts: Record<string, { text: string; href: string }> = {
    add_diary:        { text: "Записать самочувствие", href: "/diary" },
    add_vitals:       { text: "Добавить показатели", href: "/vitals" },
    upload_document:  { text: "Загрузить документ", href: "/documents" },
    add_medications:  { text: "Добавить лекарства", href: "/medications" },
    add_emotions:     { text: "Отметить настроение", href: "/emotions" },
    update_diary:     { text: "Обновить дневник", href: "/diary" },
    none:             { text: "Просмотреть хронологию", href: "/timeline" },
  };
  // Next action: when no concern, prioritize baseline fill over MCO action
  let nextAction: { text: string; reason: string; href: string };
  if (!concernTitle && !hasBaseline) {
    nextAction = { text: "Заполнить базовый профиль", reason: "Без базового контекста агент не может строить картину", href: "/profile" };
  } else {
    const act = actionTexts[mco.priority_action] ?? actionTexts.add_diary;
    const reason = concernTitle
      ? (concernReasons[mco.priority_action] ?? genericReasons[mco.priority_action] ?? genericReasons.add_diary)
      : (genericReasons[mco.priority_action] ?? genericReasons.add_diary);
    nextAction = { text: act.text, reason, href: act.href };
  }

  // Missing domains (labels of domains with no data)
  const missingDomains: string[] = [];
  if (c.diary === 0) missingDomains.push("Дневник самочувствия");
  if (c.vitals === 0) missingDomains.push("Показатели");
  if (c.documents === 0) missingDomains.push("Документы");
  if (c.medications === 0) missingDomains.push("Лекарства");
  if (c.emotions === 0) missingDomains.push("Эмоции");
  if (!hasBaseline) missingDomains.push("Базовый профиль");

  // Missing evidence items — concern-aware, with source domain for traceability
  type MI = { text: string; targetHref: string; sourceDomain: string };
  const mi = (text: string, targetHref: string, sourceDomain: string): MI => ({ text, targetHref, sourceDomain });

  // Missing items — ordered to match MCO priority_action so first item ≈ CTA target
  // MCO priority: diary → vitals → documents → medications → emotions
  const missingItems: MI[] = [];
  if (c.diary === 0) missingItems.push(mi(
    concernTitle ? `Нет записей самочувствия по «${concernTitle}»` : "Нет записей самочувствия",
    "/diary", "Дневник"));
  if (c.vitals === 0) missingItems.push(mi(
    "Нет показателей — давление, пульс, температура", "/vitals", "Показатели"));
  if (c.documents === 0) missingItems.push(mi(
    "Нет документов или анализов", "/documents", "Документы"));
  if (c.medications === 0) missingItems.push(mi(
    "Нет данных по лекарствам", "/medications", "Лекарства"));
  if (c.emotions === 0 && missingItems.length < 4) missingItems.push(mi(
    "Эмоциональный фон не отслеживается", "/emotions", "Эмоции"));
  if (c.symptoms === 0 && c.diary > 0 && missingItems.length < 4) missingItems.push(mi(
    "Нет зафиксированных симптомов", "/diary", "Дневник"));
  // Baseline: prepend if CTA targets profile (low_data, no concern), else append
  if (!hasBaseline) {
    const baselineItem = mi("Нет базового профиля — пол, возраст, диагнозы", "/profile", "Профиль");
    if (!concernTitle) {
      missingItems.unshift(baselineItem);
    } else if (missingItems.length < 4) {
      missingItems.push(baselineItem);
    }
  }

  // Active domain labels — domains with data, for pre-hypothesis traceability
  const activeDomainLabels: string[] = [];
  if (c.diary > 0) activeDomainLabels.push("Дневник");
  if (c.vitals > 0) activeDomainLabels.push("Показатели");
  if (c.medications > 0) activeDomainLabels.push("Лекарства");
  if (c.documents > 0) activeDomainLabels.push("Документы");
  if (c.emotions > 0) activeDomainLabels.push("Эмоции");
  if (hasBaseline) activeDomainLabels.push("Профиль");

  // Data snapshot: 2–4 factual signal lines with source module links
  type SnapItem = { text: string; href: string };
  const dataSnapshot: SnapItem[] = [];
  if (wbScore != null) {
    dataSnapshot.push({ text: `Самочувствие ${wbScore}/10 (${relTime(latestDiary?.created_at) ?? "недавно"})`, href: "/diary" });
  }
  if (latestVital) {
    const vLabel = latestVital.vital_type === "blood_pressure" ? "Давление" : latestVital.vital_type;
    dataSnapshot.push({ text: `${vLabel} ${latestVital.value}${latestVital.unit ? " " + latestVital.unit : ""} (${relTime(latestVital.measured_at) ?? "недавно"})`, href: "/vitals" });
  }
  if (symptomsArr && symptomsArr.length > 0) {
    dataSnapshot.push({ text: `Симптомы: ${symptomsArr.slice(0, 2).join(", ")}`, href: "/diary" });
  }
  if (mc > 0) {
    dataSnapshot.push({ text: `${plu(mc, "активный препарат", "активных препарата", "активных препаратов")}`, href: "/medications" });
  }
  if (dc > 0 && dataSnapshot.length < 4) {
    dataSnapshot.push({ text: `${plu(dc, "документ", "документа", "документов")} загружено`, href: "/documents" });
  }
  if (latestEmotion && dataSnapshot.length < 4) {
    dataSnapshot.push({ text: `Эмоции зафиксированы (${relTime(latestEmotion.created_at) ?? "недавно"})`, href: "/emotions" });
  }

  const serverMeta: ServerMeta = {
    greeting,
    observation,
    nextAction,
    missingDomains,
    missingItems: missingItems.slice(0, 4),
    activeDomainLabels,
    dataSnapshot: dataSnapshot.slice(0, 4),
  };

  // Can generate hypothesis: concern exists + no hypothesis + >=2 core domains
  const coreDomainCount = (c.diary > 0 ? 1 : 0) + (c.vitals > 0 ? 1 : 0) + (c.documents > 0 ? 1 : 0) + (c.medications > 0 ? 1 : 0) + (c.symptoms > 0 ? 1 : 0);
  const canGenerate = !!concernRow && !realHypothesis && hasAnyCoreDomain && coreDomainCount >= 2;

  // Can regenerate: concern + hypothesis exist + still enough data
  const canRegenerate = !!concernRow && !!realHypothesis && coreDomainCount >= 2;

  // Meaningful-delta stale detection: concern-bound first, then patient-wide fallback
  let hypothesisIsStale = false;
  let hypothesisStaleReasons: string[] = [];

  if (realHypothesis?.updated_at && concernRow) {
    const staleMeta = await getHypothesisStaleMeta(
      supabase as unknown as SupabaseClient,
      patientId,
      concernRow.id,
      realHypothesis.updated_at,
      concernUpdatedAt,
    );
    hypothesisIsStale = staleMeta.isStale;
    hypothesisStaleReasons = staleMeta.reasons;
  }

  // Factual concern evidence meta — same selection logic as hypothesis generation
  let hypothesisConcernEvidence: { diary: number; vitals: number; documents: number } | null = null;
  if (realHypothesis && concernRow) {
    const evidenceMeta = await getConcernEvidenceMeta(supabase as unknown as SupabaseClient, patientId, concernRow.id);
    if (evidenceMeta.usedConcernData) {
      hypothesisConcernEvidence = { diary: evidenceMeta.diary, vitals: evidenceMeta.vitals, documents: evidenceMeta.documents };
    }
  }

  return (
    <DataFlowDashboard
      realDomains={realDomains}
      serverMeta={serverMeta}
      demoState={demoState}
      realConcern={realConcern}
      realHypothesis={realHypothesis}
      concernId={concernRow?.id}
      canGenerate={canGenerate}
      canRegenerate={canRegenerate}
      hypothesisIsStale={hypothesisIsStale}
      hypothesisStaleReasons={hypothesisStaleReasons}
      hypothesisMetaLabel={realHypothesis ? `обновлено ${relTime(realHypothesis.updated_at) ?? "недавно"}` : null}
      concernLinkage={concernLinkage}
      hypothesisConcernEvidence={hypothesisConcernEvidence}
    />
  );
}
