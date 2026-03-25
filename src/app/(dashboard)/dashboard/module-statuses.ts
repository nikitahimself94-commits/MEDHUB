import type { McoSnapshot, PriorityActionKey } from "@/lib/mco";

// ---------------------------------------------------------------------------
// Module micro-statuses — deterministic mapping from MCO to agent-style
// one-liners per module. Presentation layer only, no data mutation.
// ---------------------------------------------------------------------------

export interface ModuleStatus {
  key: string;
  label: string;
  href: string;
  status: string;
  isPrimary: boolean;  // true = matches current priority_action
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

  return [
    {
      key: "diary",
      label: "Дневник",
      href: "/diary",
      status: diaryStatus(c.diary, mco.priority_action, mco.days_absent),
      isPrimary: priorityModule === "diary",
    },
    {
      key: "vitals",
      label: "Показатели",
      href: "/vitals",
      status: vitalsStatus(c.vitals, priorityModule === "vitals"),
      isPrimary: priorityModule === "vitals",
    },
    {
      key: "documents",
      label: "Документы",
      href: "/documents",
      status: documentsStatus(c.documents, priorityModule === "documents"),
      isPrimary: priorityModule === "documents",
    },
    {
      key: "medications",
      label: "Лекарства",
      href: "/medications",
      status: medicationsStatus(c.medications, priorityModule === "medications"),
      isPrimary: priorityModule === "medications",
    },
    {
      key: "emotions",
      label: "Эмоции",
      href: "/emotions",
      status: emotionsStatus(c.emotions, priorityModule === "emotions"),
      isPrimary: priorityModule === "emotions",
    },
    {
      key: "symptoms",
      label: "Симптомы",
      href: "/symptoms-map",
      status: symptomsStatus(c.symptoms),
      isPrimary: false, // symptoms has no dedicated priority_action
    },
  ];
}

// ---------------------------------------------------------------------------
// Per-module status resolvers
// ---------------------------------------------------------------------------

function diaryStatus(score: number, action: PriorityActionKey, daysAbsent: number): string {
  if (score === 0) return "жду первую запись";
  if (action === "update_diary" && daysAbsent >= 1) return "можно обновить";
  if (score < 0.6) return "есть начало";
  if (score < 1) return "картина набирается";
  return "данные поступают";
}

function vitalsStatus(score: number, isPrimary: boolean): string {
  if (score === 0) return isPrimary ? "жду первый показатель" : "пока пусто";
  if (score < 0.6) return "есть начало";
  if (score < 1) return "набирается";
  return "данные поступают";
}

function documentsStatus(score: number, isPrimary: boolean): string {
  if (score === 0) return isPrimary ? "жду первый документ" : "пока пусто";
  if (score < 1) return "есть начало";
  return "достаточно для анализа";
}

function medicationsStatus(score: number, isPrimary: boolean): string {
  if (score === 0) return isPrimary ? "добавьте назначения" : "пока пусто";
  return "назначения учтены";
}

function emotionsStatus(score: number, isPrimary: boolean): string {
  if (score === 0) return isPrimary ? "жду первую запись" : "пока пусто";
  if (score < 1) return "есть начало";
  return "картина видна";
}

function symptomsStatus(score: number): string {
  if (score === 0) return "пока пусто";
  if (score <= 0.5) return "записи без симптомов";
  return "отслеживаются";
}
