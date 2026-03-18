// Fullscreen first-run welcome flow — scripted conversational scenario
// No AI calls. Pure state machine with branching.

export type StepType = "agent" | "choice" | "text" | "agent_react" | "final";

export interface AgentStep {
  type: "agent";
  id: string;
  lines: string[]; // Each line appears with typing animation
  button: string;
  next: string;
}

export interface ChoiceStep {
  type: "choice";
  id: string;
  agentLine: string;
  options: { label: string; value: string; sub?: string }[];
  key: string; // saved to answers
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

// ─── PHASE 1: PRESENCE ───
// Warm greeting → who I am → what you get

const step_intro: AgentStep = {
  type: "agent",
  id: "intro",
  lines: [
    "Здравствуйте. Рад, что вы здесь.",
    "Я ваш медицинский помощник — буду рядом, пока вам это нужно.",
    "Моя задача — запоминать, замечать изменения и держать вашу картину здоровья в фокусе, чтобы вам не приходилось делать это самостоятельно.",
  ],
  button: "Продолжить",
  next: "reassure",
};

// Relief: light entry, no pressure
const step_reassure: AgentStep = {
  type: "agent",
  id: "reassure",
  lines: [
    "Сейчас — только знакомство.",
    "Пара простых вопросов, чтобы я лучше понял вашу ситуацию. Ничего сложного.",
  ],
  button: "Хорошо, давайте",
  next: "entry_mode",
};

// ─── PHASE 2: SOFT ENTRY ───
// User identifies their situation, agent meets them there

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
  next: "mirror",
};

// ─── PHASE 3: CLARIFICATION ───
// Agent mirrors choice — makes a personal promise, not a product description

const step_mirror: AgentReactStep = {
  type: "agent_react",
  id: "mirror",
  getLines: (answers) => {
    switch (answers.entry_mode) {
      case "concern":
        return [
          "Я не дам вам потерять нить.",
          "Когда придёте к врачу — у вас будет чёткая картина, а не обрывки из памяти.",
        ];
      case "systematic":
        return [
          "Я замечу то, что легко пропустить в рутине.",
          "Мелкие изменения, которые по отдельности ничего не значат — вместе могут значить многое.",
        ];
      case "caregiver":
        return [
          "Вы не обязаны помнить всё.",
          "Я буду держать картину — чтобы вы могли быть рядом с человеком, а не с бумагами.",
        ];
      default:
        return ["Понял. Давайте продолжим."];
    }
  },
  button: "Дальше",
  next: "chronic",
};

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

const step_chronic_detail: TextStep = {
  type: "text",
  id: "chronic_detail",
  agentLine: "Просто назовите — мне хватит одного слова.",
  placeholder: "Например: диабет, гипертония, наблюдение после операции",
  key: "chronic_detail",
  next: "has_documents",
  optional: true,
};

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
  next: "goal",
};

const step_goal: TextStep = {
  type: "text",
  id: "goal",
  agentLine: "Чем я могу помочь прямо сейчас?",
  placeholder: "Например: подготовиться к приёму, разобрать анализы, не забывать записывать",
  key: "primary_goal",
  next: "role_explain",
  optional: true,
};

// ─── PHASE 4: PERSONAL ROLE EXPLANATION ───
// Clarity: agent commits, using user's own answers. Not product features — personal promises.

const step_role_explain: AgentReactStep = {
  type: "agent_react",
  id: "role_explain",
  getLines: (answers) => {
    const lines: string[] = [];

    if (answers.entry_mode === "concern") {
      lines.push("Теперь я слежу за вашей ситуацией.");
      lines.push("Каждый анализ, каждая жалоба, каждый показатель — ничего не потеряется.");
    } else if (answers.entry_mode === "caregiver") {
      lines.push("Теперь эта нагрузка не только на вас.");
      lines.push("Лекарства, назначения, результаты, даты — я запомню всё.");
    } else {
      lines.push("Теперь у вас есть память, которая не подведёт.");
      lines.push("Я зафиксирую каждое изменение и покажу, если что-то заслуживает внимания.");
    }

    if (answers.has_chronic === "yes" && answers.chronic_detail) {
      lines.push(`${answers.chronic_detail} — я уже учёл. Это будет частью каждого моего ответа.`);
    }

    if (answers.entry_mode === "concern") {
      lines.push("Когда придёт время разговора с врачом — всё главное будет собрано.");
    } else if (answers.entry_mode === "caregiver") {
      lines.push("Вам останется только быть рядом.");
    } else {
      lines.push("Не нужно помнить — я помню за вас.");
    }

    return lines;
  },
  button: "Понятно",
  next: "first_action",
};

// ─── PHASE 5: FIRST STEP + ENTRY ───
// Inevitability: not "choose what to do" but "here is what we do now"

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
  reassure: step_reassure,
  entry_mode: step_entry_mode,
  mirror: step_mirror,
  chronic: step_chronic,
  chronic_detail: step_chronic_detail,
  has_documents: step_has_documents,
  goal: step_goal,
  role_explain: step_role_explain,
  first_action: step_first_action,
};

export const FIRST_STEP_ID = "intro";
