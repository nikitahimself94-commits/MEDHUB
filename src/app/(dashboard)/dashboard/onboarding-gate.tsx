"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ONBOARDING_STEPS,
  FIRST_STEP_ID,
  type OnboardingStep,
} from "./onboarding-steps";
import { completeOnboarding } from "./onboarding-actions";

// ─── TYPING ANIMATION HOOK ───

function useTypingLines(lines: string[]) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number>(0);
  const linesRef = useRef(lines);
  linesRef.current = lines;

  // Stable key — only re-run effect when actual content changes, not array reference
  const linesKey = lines.join("\n");

  useEffect(() => {
    const currentLinesSnapshot = linesRef.current;
    setVisibleLines([]);
    setDone(false);
    let lineIdx = 0;
    let charIdx = 0;
    let current: string[] = [];
    let lastTime = 0;
    const INITIAL_DELAY = 400;
    let started = false;

    function tick(time: number) {
      if (!lastTime) lastTime = time;

      if (!started) {
        if (time - lastTime < INITIAL_DELAY) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        started = true;
        lastTime = time;
      }

      const currentLine = currentLinesSnapshot[lineIdx] || "";
      const charSpeed = currentLine.length > 80 ? 18 : currentLine.length > 50 ? 24 : 30;

      if (time - lastTime >= charSpeed) {
        lastTime = time;
        if (lineIdx < currentLinesSnapshot.length) {
          const line = currentLinesSnapshot[lineIdx];
          charIdx++;
          if (charIdx <= line.length) {
            current = [...current.slice(0, lineIdx), line.slice(0, charIdx)];
            setVisibleLines([...current]);
          } else {
            lineIdx++;
            charIdx = 0;
            lastTime = time + 250;
          }
        } else {
          setDone(true);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey]);

  const skipToEnd = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setVisibleLines([...lines]);
    setDone(true);
  }, [lines]);

  return { visibleLines, done, skipToEnd };
}

// ─── MAIN GATE COMPONENT ───

export function OnboardingGate() {
  const router = useRouter();
  const [stepId, setStepId] = useState(FIRST_STEP_ID);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textValue, setTextValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const step: OnboardingStep = ONBOARDING_STEPS[stepId];

  // Stabilize lines reference — recompute only when step changes
  const currentLines: string[] = useMemo(() => {
    if (step.type === "agent") return step.lines;
    if (step.type === "agent_react") return step.getLines(answers);
    if (step.type === "final") return step.getLines(answers);
    if (step.type === "choice") return [step.agentLine];
    if (step.type === "text") return [step.agentLine];
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId]);

  const { visibleLines, done: typingDone, skipToEnd } = useTypingLines(currentLines);

  function goTo(nextId: string) {
    setTransitioning(true);
    setTimeout(() => {
      setStepId(nextId);
      setTextValue("");
      setTransitioning(false);
    }, 300);
  }

  function handleChoice(value: string) {
    setAnswers((prev) => ({ ...prev, [step.type === "choice" ? (step as { key: string }).key : ""]: value }));
    const s = step as { next: string | ((v: string) => string) };
    const nextId = typeof s.next === "function" ? s.next(value) : s.next;
    goTo(nextId);
  }

  function handleTextSubmit() {
    const trimmed = textValue.trim();
    if (step.type === "text") {
      if (trimmed) {
        setAnswers((prev) => ({ ...prev, [step.key]: trimmed }));
      }
      goTo(step.next);
    }
  }

  function handleAgentContinue() {
    if (!typingDone) {
      skipToEnd();
      return;
    }
    if (step.type === "agent") goTo(step.next);
    if (step.type === "agent_react") goTo(step.next);
  }

  async function handleFinish(href: string) {
    setSaving(true);
    try {
      await completeOnboarding(answers);
    } catch {
      // Don't block — localStorage fallback is fine
    }
    router.push(href);
    router.refresh();
  }

  // ─── RENDER ───

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ backgroundColor: "#0F1F1D" }}
    >
      {/* Subtle gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(45,110,106,0.15) 0%, transparent 70%)",
        }}
      />

      {/* Content area — centered vertically */}
      <div
        className={`relative z-10 flex flex-1 flex-col items-center justify-center px-6 transition-opacity duration-300 ${
          transitioning ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="w-full max-w-lg">
          {/* Agent label — only on first step */}
          {stepId === "intro" && (
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-6"
              style={{ color: "#4A8A82" }}
            >
              Ваш помощник
            </p>
          )}

          {/* Typing lines */}
          <div className="min-h-[120px] space-y-3">
            {visibleLines.map((line, i) => {
              // First line of agent/react/final = bold headline
              // For choice/text steps = all lines are questions, white + prominent
              const isHeadline = i === 0 && (step.type === "agent" || step.type === "agent_react" || step.type === "final");
              const isQuestion = step.type === "choice" || step.type === "text";
              return (
                <p
                  key={`${stepId}-${i}`}
                  className={`leading-relaxed ${
                    isHeadline
                      ? "text-[22px] sm:text-[26px] font-bold text-white"
                      : isQuestion
                        ? "text-[18px] sm:text-[20px] font-semibold text-white"
                        : "text-[16px] sm:text-[18px]"
                  }`}
                  style={
                    isHeadline || isQuestion ? undefined : { color: "#A0C4BE" }
                  }
                >
                  {line}
                  {i === visibleLines.length - 1 && !typingDone && (
                    <span className="inline-block w-0.5 h-5 ml-0.5 align-text-bottom animate-pulse" style={{ backgroundColor: "#2D6E6A" }} />
                  )}
                </p>
              );
            })}
          </div>

          {/* Interactive area — shows after typing completes */}
          {typingDone && (
            <div className="mt-8 animate-fadeIn">
              {/* Agent step → continue button */}
              {(step.type === "agent" || step.type === "agent_react") && (
                <button
                  type="button"
                  onClick={handleAgentContinue}
                  className="rounded-xl px-6 py-3.5 text-[15px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
                  style={{ backgroundColor: "#2D6E6A" }}
                >
                  {step.button}
                </button>
              )}

              {/* Choice step → option cards */}
              {step.type === "choice" && (
                <div className="space-y-2.5">
                  {step.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleChoice(opt.value)}
                      className="w-full text-left rounded-xl px-5 py-4 transition hover:brightness-110 active:scale-[0.99]"
                      style={{ backgroundColor: "rgba(45,110,106,0.15)", border: "1px solid rgba(45,110,106,0.25)" }}
                    >
                      <span className="text-[15px] font-semibold text-white">{opt.label}</span>
                      {opt.sub && (
                        <span className="block text-[13px] mt-0.5" style={{ color: "#7AABA4" }}>{opt.sub}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Text step → input + submit */}
              {step.type === "text" && (
                <div>
                  <textarea
                    value={textValue}
                    onChange={(e) => setTextValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleTextSubmit();
                      }
                    }}
                    placeholder={step.placeholder}
                    rows={2}
                    autoFocus
                    className="w-full rounded-xl px-5 py-3.5 text-[15px] text-white placeholder:text-white/30 resize-none outline-none transition-all focus:ring-2 focus:ring-white/10"
                    style={{ backgroundColor: "rgba(45,110,106,0.15)", border: "1px solid rgba(45,110,106,0.25)" }}
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleTextSubmit}
                      className="rounded-xl px-6 py-3 text-[15px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
                      style={{ backgroundColor: "#2D6E6A" }}
                    >
                      Дальше
                    </button>
                    {step.optional && !textValue.trim() && (
                      <button
                        type="button"
                        onClick={handleTextSubmit}
                        className="text-[13px] transition"
                        style={{ color: "#4A8A82" }}
                      >
                        Пропустить
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Final step → entry CTA */}
              {step.type === "final" && (
                <div className="space-y-3">
                  {(() => {
                    const action = step.getAction(answers);
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => handleFinish(action.href)}
                          disabled={saving}
                          className="w-full rounded-xl px-6 py-4 text-[15px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
                          style={{ backgroundColor: "#2D6E6A" }}
                        >
                          {saving ? "Сохраняю..." : action.label}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFinish("/dashboard")}
                          disabled={saving}
                          className="w-full text-center text-[13px] py-2 transition"
                          style={{ color: "#4A8A82" }}
                        >
                          Перейти на главную
                        </button>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Clickable overlay to skip typing — invisible but tappable */}
          {!typingDone && (
            <button
              type="button"
              onClick={skipToEnd}
              className="absolute inset-0 z-20 cursor-default"
              aria-label="Пропустить анимацию"
            />
          )}
        </div>
      </div>

      {/* Progress bar — very subtle at bottom, based on actual path */}
      <div className="relative z-10 px-6 pb-6">
        {(() => {
          // Build actual step sequence based on answers (excludes skipped steps)
          const base = ["intro", "entry_mode", "commit", "chronic"];
          if (answers.has_chronic === "yes") base.push("chronic_detail");
          base.push("has_documents", "first_action");
          const idx = base.indexOf(stepId);
          return (
            <div className="flex gap-1">
              {base.map((_, i) => (
                <div
                  key={i}
                  className="h-0.5 flex-1 rounded-full transition-all duration-500"
                  style={{
                    backgroundColor: idx >= i ? "#2D6E6A" : "rgba(45,110,106,0.15)",
                  }}
                />
              ))}
            </div>
          );
        })()}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
