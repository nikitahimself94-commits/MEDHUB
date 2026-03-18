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

const step_intro: AgentStep = {
  type: "agent",
  id: "intro",
  lines: [
    "Я ваш медицинский помощник.",
    "Буду держать в фокусе ваши данные, изменения и важные сигналы.",
    "Вам не придётся каждый раз собирать картину заново.",
  ],
  button: "Продолжить",
  next: "reassure",
};

const step_reassure: AgentStep = {
  type: "agent",
  id: "reassure",
  lines: [
    "Давайте познакомимся.",
    "Пара коротких вопросов — и я пойму, с чего вам лучше начать.",
  ],
  button: "Хорошо",
  next: "entry_mode",
};

// ─── PHASE 2: SOFT ENTRY ───

const step_entry_mode: ChoiceStep = {
  type: "choice",
  id: "entry_mode",
  agentLine: "Что ближе к вашей ситуации?",
  options: [
    {
      label: "Что-то беспокоит",
      value: "concern",
      sub: "Хочу разобраться и не терять из виду",
    },
    {
      label: "Хочу следить системно",
      value: "systematic",
      sub: "Вести здоровье в одном месте",
    },
    {
      label: "Помогаю близкому",
      value: "caregiver",
      sub: "Хочу держать картину под контролем",
    },
  ],
  key: "entry_mode",
  next: "mirror",
};

// ─── PHASE 3: CLARIFICATION ───

const step_mirror: AgentReactStep = {
  type: "agent_react",
  id: "mirror",
  getLines: (answers) => {
    switch (answers.entry_mode) {
      case "concern":
        return [
          "Помогу не потерять картину.",
          "Чтобы разговор с врачом был предметным, а не по памяти.",
        ];
      case "systematic":
        return [
          "Буду собирать всё в одну линию.",
          "Так проще видеть изменения, пока они мелкие.",
        ];
      case "caregiver":
        return [
          "Помогу снять часть нагрузки.",
          "Буду удерживать всю картину в одном месте — вам не придётся держать это в голове.",
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
  agentLine: "Есть что-то длительное — хроническое заболевание, регулярное наблюдение, курс лечения?",
  options: [
    { label: "Да, есть", value: "yes" },
    { label: "Нет", value: "no" },
    { label: "Не уверен", value: "unsure" },
  ],
  key: "has_chronic",
  next: (value) => (value === "yes" ? "chronic_detail" : "has_documents"),
};

const step_chronic_detail: TextStep = {
  type: "text",
  id: "chronic_detail",
  agentLine: "Коротко — что это? Не нужно подробностей, мне достаточно направления.",
  placeholder: "Например: диабет, гипертония, наблюдение после операции",
  key: "chronic_detail",
  next: "has_documents",
  optional: true,
};

const step_has_documents: ChoiceStep = {
  type: "choice",
  id: "has_documents",
  agentLine: "Есть ли у вас уже документы — анализы, выписки, заключения? Неважно, свежие или старые.",
  options: [
    { label: "Есть, могу загрузить", value: "yes" },
    { label: "Пока нет", value: "no" },
    { label: "Потом разберусь", value: "later" },
  ],
  key: "has_documents",
  next: "goal",
};

const step_goal: TextStep = {
  type: "text",
  id: "goal",
  agentLine: "Что для вас сейчас было бы самой полезной помощью?",
  placeholder: "Например: подготовиться к приёму, разобрать анализы, просто не забывать записывать",
  key: "primary_goal",
  next: "role_explain",
  optional: true,
};

// ─── PHASE 4: PERSONAL ROLE EXPLANATION ───

const step_role_explain: AgentReactStep = {
  type: "agent_react",
  id: "role_explain",
  getLines: (answers) => {
    const lines: string[] = [];

    if (answers.entry_mode === "concern") {
      lines.push("Я соберу всё в одну картину.");
      lines.push("Записи, показатели, документы — чтобы было видно, как ситуация меняется со временем.");
    } else if (answers.entry_mode === "caregiver") {
      lines.push("Я возьму на себя картину целиком.");
      lines.push("Записи, показатели, документы, лекарства — всё в одном месте.");
    } else {
      lines.push("Я буду следить за изменениями.");
      lines.push("Записи и показатели в одной линии — со временем покажу тренды.");
    }

    if (answers.has_chronic === "yes" && answers.chronic_detail) {
      lines.push(`${answers.chronic_detail} — уже часть контекста. Учту в каждом ответе.`);
    }

    lines.push("К врачу — не с пустыми руками. Важное — на виду.");

    return lines;
  },
  button: "Понятно",
  next: "first_action",
};

// ─── PHASE 5: FIRST STEP + ENTRY ───

const step_first_action: FinalStep = {
  type: "final",
  id: "first_action",
  getLines: (answers) => {
    if (answers.has_documents === "yes") {
      return [
        "Вот с чего нам лучше начать.",
        "Загрузите один документ — любой анализ или выписку. Это даст мне первую реальную опору, и дальше я смогу работать не вслепую.",
      ];
    }
    return [
      "Вот с чего нам лучше начать.",
      "Запишите, как вы сейчас себя чувствуете. Одна запись — и у меня уже будет первая точка, от которой можно отталкиваться.",
    ];
  },
  getAction: (answers) => {
    if (answers.has_documents === "yes") {
      return { label: "Загрузить первый документ", href: "/documents" };
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
