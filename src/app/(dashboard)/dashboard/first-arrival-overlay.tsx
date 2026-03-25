"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "medhub:arrival_shown";
const DELAY_MS = 1800;

/**
 * First Arrival Overlay v2 — agent arrival event after onboarding.
 * Full-presence moment: strong backdrop, responsive card, warm copy.
 * After dismiss: brief hero highlight as a bridge into the workspace.
 */
export function FirstArrivalOverlay({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"hidden" | "entering" | "visible" | "leaving">("hidden");

  useEffect(() => {
    if (!show) return;

    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
      setPhase("entering");
      // Enter animation completes after 500ms
      setTimeout(() => setPhase("visible"), 50);
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, [show]);

  function dismiss() {
    setPhase("leaving");
    setTimeout(() => {
      setVisible(false);
      setPhase("hidden");
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
      // Brief hero highlight as bridge into workspace
      const hero = document.querySelector("[data-hero]");
      if (hero) {
        hero.classList.add("hero-arrival-glow");
        setTimeout(() => hero.classList.remove("hero-arrival-glow"), 2500);
      }
    }, 400);
  }

  if (!visible) return null;

  const isActive = phase === "visible";
  const isLeaving = phase === "leaving";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] transition-opacity duration-500 ease-out"
        style={{
          backgroundColor: "rgba(10,22,20,0.9)",
          opacity: isLeaving ? 0 : isActive ? 1 : 0,
        }}
        onClick={dismiss}
      />

      {/* Card */}
      <div
        className="fixed inset-0 z-[91] flex items-center justify-center px-5 pointer-events-none"
      >
        <div
          className="pointer-events-auto w-full rounded-2xl transition-all duration-500 ease-out"
          style={{
            maxWidth: "clamp(340px, 50vw, 520px)",
            padding: "clamp(28px, 4vw, 48px)",
            backgroundColor: "#1A2F2B",
            boxShadow: "0 0 80px rgba(45,110,106,0.12), 0 0 0 1px rgba(45,110,106,0.15)",
            opacity: isLeaving ? 0 : isActive ? 1 : 0,
            transform: isLeaving
              ? "scale(0.97) translateY(8px)"
              : isActive
                ? "scale(1) translateY(0)"
                : "scale(0.95) translateY(16px)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Agent label */}
          <p
            className="font-semibold uppercase"
            style={{
              fontSize: "clamp(10px, 1.2vw, 12px)",
              letterSpacing: "0.15em",
              color: "#4A8A82",
            }}
          >
            Твой помощник
          </p>

          {/* Headline */}
          <p
            className="font-bold leading-tight text-white"
            style={{
              marginTop: "clamp(12px, 2vw, 20px)",
              fontSize: "clamp(22px, 3vw, 32px)",
            }}
          >
            Ты внутри.
          </p>

          {/* Body */}
          <p
            className="leading-relaxed"
            style={{
              marginTop: "clamp(10px, 1.5vw, 16px)",
              fontSize: "clamp(14px, 1.6vw, 17px)",
              color: "#A0C4BE",
            }}
          >
            Здесь дневник, показатели, документы, лекарства —
            всё, что нужно для твоей картины здоровья.
          </p>
          <p
            className="leading-relaxed"
            style={{
              marginTop: "clamp(6px, 1vw, 10px)",
              fontSize: "clamp(14px, 1.6vw, 17px)",
              color: "#A0C4BE",
            }}
          >
            Не нужно разбираться во всём сразу. Я подскажу, с чего начать.
          </p>

          {/* CTA */}
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-xl font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
            style={{
              marginTop: "clamp(20px, 3vw, 32px)",
              padding: "clamp(14px, 1.8vw, 18px)",
              fontSize: "clamp(15px, 1.6vw, 17px)",
              backgroundColor: "#2D6E6A",
            }}
          >
            Начнём
          </button>
        </div>
      </div>

      {/* Hero glow style — injected once, used after dismiss */}
      <style>{`
        @keyframes heroGlow {
          0% { box-shadow: 0 0 0 2px rgba(45,110,106,0.5), 0 0 24px rgba(45,110,106,0.15); }
          100% { box-shadow: 0 0 0 0px rgba(45,110,106,0), 0 0 0px rgba(45,110,106,0); }
        }
        .hero-arrival-glow {
          animation: heroGlow 2.5s ease-out forwards;
        }
      `}</style>
    </>
  );
}
