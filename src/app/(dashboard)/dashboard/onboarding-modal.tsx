"use client";

import { useState, useEffect } from "react";
import { saveOnboardingContext } from "./onboarding-actions";

const STORAGE_KEY = "medhub_onboarding_seen";

interface Step {
  question: string;
  placeholder: string;
  key: string;
}

const STEPS: Step[] = [
  {
    question: "С чем вы пришли? Коротко опишите ситуацию — что лечите, что беспокоит, или просто хотите вести учёт здоровья.",
    placeholder: "Например: слежу за давлением после операции",
    key: "reason",
  },
  {
    question: "Что беспокоит прямо сейчас? Есть ли жалобы, симптомы, дискомфорт?",
    placeholder: "Например: периодические головные боли, плохой сон",
    key: "current_concern",
  },
  {
    question: "Есть ли хроническая история — длительное заболевание, регулярное наблюдение, курс лечения?",
    placeholder: "Например: диабет 2 типа уже 5 лет",
    key: "chronic",
  },
  {
    question: "Есть ли у вас уже какие-то документы — анализы, выписки, заключения? Можно загрузить позже.",
    placeholder: "Например: есть свежий анализ крови",
    key: "documents",
  },
  {
    question: "Что вы хотите получить от MedHUB? Это поможет мне сфокусироваться на важном.",
    placeholder: "Например: понять динамику показателей, подготовиться к визиту к врачу",
    key: "goal",
  },
];

const LABELS: Record<string, string> = {
  reason: "Причина обращения",
  current_concern: "Текущие жалобы",
  chronic: "Хроническая история",
  documents: "Имеющиеся документы",
  goal: "Цель использования",
};

export function OnboardingModal() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);

  async function finishOnboarding(finalAnswers: Record<string, string>) {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);

    // Persist to DB — non-blocking, don't fail the UI
    if (Object.keys(finalAnswers).length > 0) {
      try {
        await saveOnboardingContext(finalAnswers);
      } catch {
        // Silently fail — localStorage already has the flag
      }
    }
  }

  function handleNext() {
    const trimmed = currentAnswer.trim();
    const updatedAnswers = trimmed
      ? { ...answers, [STEPS[step].key]: trimmed }
      : answers;

    if (trimmed) {
      setAnswers(updatedAnswers);
    }
    setCurrentAnswer("");

    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finishOnboarding(updatedAnswers);
    }
  }

  function handleSkip() {
    setCurrentAnswer("");
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finishOnboarding(answers);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  }

  if (!show) return null;

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
      <div
        className="w-full max-w-lg rounded-2xl p-5 sm:p-8 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "#FAFBFB" }}
      >
        {/* Agent identity */}
        {step === 0 && (
          <div className="mb-5">
            <h2
              className="text-xl font-bold tracking-wide"
              style={{ color: "#1A2F2B" }}
            >
              Здравствуйте. Я ваш медицинский помощник.
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "#3D6B62" }}>
              Давайте познакомимся — я задам несколько коротких вопросов, чтобы лучше понимать вашу ситуацию. Отвечайте как удобно, можно пропускать.
            </p>
          </div>
        )}

        {/* Progress */}
        <div className="flex gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all"
              style={{
                backgroundColor: i <= step ? "#2D6E6A" : "#E0E5E3",
              }}
            />
          ))}
        </div>

        {/* Question bubble */}
        <div
          className="rounded-xl px-4 py-3 text-sm leading-relaxed"
          style={{ backgroundColor: "rgba(45,110,106,0.06)", color: "#1A2F2B" }}
        >
          {currentStep.question}
        </div>

        {/* Answer input */}
        <textarea
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentStep.placeholder}
          rows={2}
          autoFocus
          className="mt-3 w-full rounded-xl border border-gray-200 bg-white/60 px-4 py-2.5 text-sm transition-all focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/10 resize-none"
        />

        {/* Actions */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm transition"
            style={{ color: "#8AA8A2" }}
          >
            {isLast ? "Пропустить и начать" : "Пропустить"}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98]"
            style={{ backgroundColor: "#2D6E6A" }}
          >
            {isLast ? "Начать работу" : "Далее"}
          </button>
        </div>

        {/* Step counter */}
        <p className="mt-3 text-center text-xs" style={{ color: "#BFC8C5" }}>
          {step + 1} из {STEPS.length}
        </p>
      </div>
    </div>
  );
}

/** Format onboarding context for AI consumption */
export function formatOnboardingContext(ctx: Record<string, string> | null): string | null {
  if (!ctx || Object.keys(ctx).length === 0) return null;

  const lines: string[] = [];
  for (const [key, value] of Object.entries(ctx)) {
    const label = LABELS[key] || key;
    if (value) lines.push(`${label}: ${value}`);
  }
  return lines.length > 0 ? lines.join("\n") : null;
}
