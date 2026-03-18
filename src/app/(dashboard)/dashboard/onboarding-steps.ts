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
    "Здравствуйте.",
    "Я ваш медицинский помощник.",
    "Я буду держать в фокусе ваши данные, изменения и важные сигналы — чтобы вам не приходилось каждый раз собирать картину заново.",
  ],
  button: "Продолжить",
  next: "reassure",
};

const step_reassure: AgentStep = {
  type: "agent",
  id: "reassure",
  lines: [
    "Сейчас я не буду перегружать вас вопросами.",
    "Давайте просто познакомимся — я пойму, с чего для вас лучше начать.",
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
          "Понял.",
          "Я помогу не потерять картину и лучше видеть, что происходит — чтобы разговор с врачом был предметным, а не по памяти.",
        ];
      case "systematic":
        return [
          "Хороший подход.",
          "Я буду собирать данные в одну линию и показывать динамику — так проще видеть изменения, пока они мелкие.",
        ];
      case "caregiver":
        return [
          "Понимаю.",
          "Я помогу снять часть нагрузки — буду удерживать всю картину в одном месте, чтобы вам не приходилось держать это в голове.",
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
    lines.push("Вот как я буду работать с вами:");

    if (answers.entry_mode === "concern") {
      lines.push("Я соберу ваши записи, показатели и документы в одну линию — чтобы было видно, как ситуация меняется со временем.");
      lines.push("Покажу, где картина уже складывается, а где пока не хватает опоры для уверенных выводов.");
    } else if (answers.entry_mode === "caregiver") {
      lines.push("Я буду удерживать все данные в одном месте — записи, показатели, документы, лекарства.");
      lines.push("Вам не придётся вспоминать, что когда было — я покажу картину целиком.");
    } else {
      lines.push("Я буду собирать ваши записи и показатели в одну линию и следить за изменениями.");
      lines.push("Со временем покажу тренды и подскажу, на что обратить внимание.");
    }

    if (answers.has_chronic === "yes" && answers.chronic_detail) {
      lines.push(`Учту, что есть ${answers.chronic_detail} — это будет частью контекста в каждом моём ответе.`);
    }

    lines.push("Я помогу не приходить к врачу с пустыми руками и быстрее видеть важное.");

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
