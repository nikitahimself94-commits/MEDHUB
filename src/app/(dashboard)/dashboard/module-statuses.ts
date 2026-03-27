import type { McoSnapshot, PriorityActionKey } from "@/lib/mco";

// ---------------------------------------------------------------------------
// Module micro-statuses — deterministic mapping from MCO to agent-style
// one-liners per module. Presentation layer only, no data mutation.
// Max 2–5 words. Reflect actual state, not generic placeholders.
// ---------------------------------------------------------------------------

export interface ModuleStatus {
  key: string;
  label: string;
  href: string;
  status: string;
  isPrimary: boolean;  // true = matches current priority_action
  stale: boolean;      // true = data exists but is outdated
}

// Which priority_action keys map to which module
const PRIORITY_TO_MODULE: Record<PriorityActionKey, string | null> = {
  add_diary: "diary",
  add_vitals: "vitals",
  upload_document: "documents",
  add_medications: "medications",
  add_emotions: "emotions",
  update_diary: "diary",
  none: null,
};

export function moduleStatuses(mco: McoSnapshot): ModuleStatus[] {
  const c = mco.data_completeness;
  const priorityModule = PRIORITY_TO_MODULE[mco.priority_action];

  const staleThreshold = 3;

  return [
    {
      key: "diary",
      label: "Дневник",
      href: "/diary",
      status: diaryStatus(c.diary, mco.priority_action, mco.days_absent),
      isPrimary: priorityModule === "diary",
      stale: c.diary > 0 && mco.days_absent >= staleThreshold,
    },
    {
      key: "vitals",
      label: "Показатели",
      href: "/vitals",
      status: vitalsStatus(c.vitals, mco.days_absent, priorityModule === "vitals"),
      isPrimary: priorityModule === "vitals",
      stale: c.vitals > 0 && mco.days_absent >= staleThreshold,
    },
    {
      key: "documents",
      label: "Документы",
      href: "/documents",
      status: documentsStatus(c.documents, priorityModule === "documents"),
      isPrimary: priorityModule === "documents",
      stale: false,
    },
    {
      key: "medications",
      label: "Лекарства",
      href: "/medications",
      status: medicationsStatus(c.medications, priorityModule === "medications"),
      isPrimary: priorityModule === "medications",
      stale: false,
    },
    {
      key: "emotions",
      label: "Эмоции",
      href: "/emotions",
      status: emotionsStatus(c.emotions, priorityModule === "emotions"),
      isPrimary: priorityModule === "emotions",
      stale: c.emotions > 0 && mco.days_absent >= staleThreshold,
    },
    {
      key: "symptoms",
      label: "Симптомы",
      href: "/symptoms-map",
      status: symptomsStatus(c.symptoms),
      isPrimary: false,
      stale: false,
    },
    {
      key: "lifestyle",
      label: "Образ жизни",
      href: "/timeline",
      status: lifestyleStatus(c.diary, c.vitals, mco.days_absent),
      isPrimary: false,
      stale: (c.diary > 0 || c.vitals > 0) && mco.days_absent >= 7,
    },
  ];
}

// ---------------------------------------------------------------------------
// Per-module status resolvers
// ---------------------------------------------------------------------------

function diaryStatus(score: number, action: PriorityActionKey, daysAbsent: number): string {
  if (score === 0) return "нет записей";
  if (action === "update_diary" && daysAbsent >= 3) return "давно без записей";
  if (action === "update_diary") return "можно обновить";
  if (score >= 1) return "данные поступают";
  if (score >= 0.6) return "набирается картина";
  return "начало есть";
}

function vitalsStatus(score: number, daysAbsent: number, isPrimary: boolean): string {
  if (score === 0) return isPrimary ? "нет показателей" : "нет данных";
  if (score >= 1) return "данные актуальны";
  if (daysAbsent >= 3 && score > 0) return "нужны свежие цифры";
  if (score >= 0.6) return "набирается";
  return "начало есть";
}

function documentsStatus(score: number, isPrimary: boolean): string {
  if (score === 0) return isPrimary ? "нет документов" : "нет загрузок";
  if (score >= 1) return "есть для анализа";
  return "загружены";
}

function medicationsStatus(score: number, isPrimary: boolean): string {
  if (score === 0) return isPrimary ? "не указаны" : "нет данных";
  return "учтены";
}

function emotionsStatus(score: number, isPrimary: boolean): string {
  if (score === 0) return isPrimary ? "нет записей" : "нет данных";
  if (score >= 1) return "картина видна";
  return "начало есть";
}

function symptomsStatus(score: number): string {
  if (score === 0) return "нет данных";
  if (score <= 0.5) return "без деталей";
  return "отслеживаются";
}

function lifestyleStatus(diaryScore: number, vitalsScore: number, daysAbsent: number): string {
  if (diaryScore === 0 && vitalsScore === 0) return "нет активности";
  if (daysAbsent >= 7) return "давно без обновлений";
  if (daysAbsent >= 3) return "нерегулярно";
  if (diaryScore > 0 && vitalsScore > 0) return "активность видна";
  return "есть записи";
}
