// Fullscreen first-run welcome flow — scripted conversational scenario
// No AI calls. Pure state machine with branching.
// Baseline v1: 7 steps (6 typical path), 3 questions.

export type StepType = "agent" | "choice" | "text" | "agent_react" | "final";

export interface AgentStep {
  type: "agent";
  id: string;
  lines: string[];
  button: string;
  next: string;
}

export interface ChoiceStep {
  type: "choice";
  id: string;
  agentLine: string;
  options: { label: string; value: string; sub?: string }[];
  key: string;
  next: string | ((value: string) => string);
}

export interface TextStep {
  type: "text";
  id: string;
  agentLine: string;
  placeholder: string;
  key: string;
  next: string;
  optional?: boolean;
}

export interface AgentReactStep {
  type: "agent_react";
  id: string;
  getLines: (answers: Record<string, string>) => string[];
  button: string;
  next: string;
}

export interface FinalStep {
  type: "final";
  id: string;
  getLines: (answers: Record<string, string>) => string[];
  getAction: (answers: Record<string, string>) => { label: string; href: string };
}

export type OnboardingStep = AgentStep | ChoiceStep | TextStep | AgentReactStep | FinalStep;

// ─── STEP 1: INTRO ───
// Greeting + reassurance in one beat. No second passive screen.

const step_intro: AgentStep = {
  type: "agent",
  id: "intro",
  lines: [
    "Здравствуйте. Рад, что вы здесь.",
    "Я ваш медицинский помощник — буду рядом, пока вам это нужно. Моя задача — запоминать, замечать изменения и держать вашу картину здоровья в фокусе.",
    "Сейчас — пара коротких вопросов, чтобы я понял вашу ситуацию.",
  ],
  button: "Хорошо, давайте",
  next: "entry_mode",
};

// ─── STEP 2: ENTRY MODE ───
// Why are you here? Three paths.

const step_entry_mode: ChoiceStep = {
  type: "choice",
  id: "entry_mode",
  agentLine: "Что привело вас сюда?",
  options: [
    {
      label: "Есть конкретная проблема",
      value: "concern",
      sub: "Что-то беспокоит, хочу разобраться",
    },
    {
      label: "Хочу следить за здоровьем",
      value: "systematic",
      sub: "Ничего срочного, но хочу держать руку на пульсе",
    },
    {
      label: "Помогаю близкому человеку",
      value: "caregiver",
      sub: "Важно, чтобы ничего не терялось",
    },
  ],
  key: "entry_mode",
  next: "commit",
};

// ─── STEP 3: COMMIT ───
// Mirrors choice + makes personal commitment + explains role. One step instead of two.

const step_commit: AgentReactStep = {
  type: "agent_react",
  id: "commit",
  getLines: (answers) => {
    switch (answers.entry_mode) {
      case "concern":
        return [
          "Я не дам вам потерять нить.",
          "Каждый анализ, каждая жалоба, каждый показатель — ничего не потеряется. Когда придёте к врачу — у вас будет чёткая картина, а не обрывки из памяти.",
        ];
      case "systematic":
        return [
          "Я замечу то, что легко пропустить в рутине.",
          "Зафиксирую каждое изменение и покажу, если что-то заслуживает внимания. Мелкие сигналы, которые по отдельности ничего не значат — вместе могут значить многое.",
        ];
      case "caregiver":
        return [
          "Вы не обязаны помнить всё.",
          "Лекарства, назначения, результаты, даты — я запомню. Чтобы вы могли быть рядом с человеком, а не с бумагами.",
        ];
      default:
        return ["Понял. Давайте продолжим."];
    }
  },
  button: "Дальше",
  next: "chronic",
};

// ─── STEP 4: CHRONIC ───

const step_chronic: ChoiceStep = {
  type: "choice",
  id: "chronic",
  agentLine: "Есть что-то, с чем вы живёте давно?",
  options: [
    { label: "Да", value: "yes" },
    { label: "Нет", value: "no" },
    { label: "Сложно сказать", value: "unsure" },
  ],
  key: "has_chronic",
  next: (value) => (value === "yes" ? "chronic_detail" : "has_documents"),
};

// ─── STEP 4b: CHRONIC DETAIL (branch) ───

const step_chronic_detail: TextStep = {
  type: "text",
  id: "chronic_detail",
  agentLine: "Просто назовите — мне хватит одного слова.",
  placeholder: "Например: диабет, гипертония, наблюдение после операции",
  key: "chronic_detail",
  next: "has_documents",
  optional: true,
};

// ─── STEP 5: DOCUMENTS ───

const step_has_documents: ChoiceStep = {
  type: "choice",
  id: "has_documents",
  agentLine: "У вас есть какие-то документы — анализы, выписки, снимки?",
  options: [
    { label: "Да, есть", value: "yes" },
    { label: "Пока нет", value: "no" },
    { label: "Разберусь позже", value: "later" },
  ],
  key: "has_documents",
  next: "first_action",
};

// ─── STEP 6: FIRST ACTION ───

const step_first_action: FinalStep = {
  type: "final",
  id: "first_action",
  getLines: (answers) => {
    if (answers.has_documents === "yes") {
      return [
        "Первый шаг — прямо сейчас.",
        "Загрузите любой документ — анализ, выписку, что угодно. Мне не нужен идеальный файл. Нужна первая опора.",
      ];
    }
    return [
      "Первый шаг — прямо сейчас.",
      "Просто запишите, как вы себя чувствуете. Одного предложения хватит — дальше я подхвачу.",
    ];
  },
  getAction: (answers) => {
    if (answers.has_documents === "yes") {
      return { label: "Загрузить документ", href: "/documents" };
    }
    return { label: "Записать самочувствие", href: "/diary" };
  },
};

// ─── STEP REGISTRY ───

export const ONBOARDING_STEPS: Record<string, OnboardingStep> = {
  intro: step_intro,
  entry_mode: step_entry_mode,
  commit: step_commit,
  chronic: step_chronic,
  chronic_detail: step_chronic_detail,
  has_documents: step_has_documents,
  first_action: step_first_action,
};

export const FIRST_STEP_ID = "intro";
