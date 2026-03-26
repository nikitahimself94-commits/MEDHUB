"use client";

import { useState, useEffect, useRef } from "react";

// v2 key — distinct from v1 to avoid stale localStorage suppression
const STORAGE_KEY = "medhub:arrival_v2";
const DELAY_MS = 1800;

/**
 * First Arrival Overlay — agent arrival event after onboarding.
 * Presence-layer: staged cascade reveal, ambient glow, spring motion.
 * After dismiss: hero highlight bridge into workspace.
 */
export function FirstArrivalOverlay({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<
    "hidden" | "backdrop" | "card" | "content" | "ready" | "leaving"
  >("hidden");
  const mountId = useRef(0);

  useEffect(() => {
    const id = ++mountId.current;
    let alreadyShown = false;
    try {
      alreadyShown = !!localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }

    if (!show) return;
    if (alreadyShown) return;

    const timer = setTimeout(() => {
      if (mountId.current !== id) return;
      setVisible(true);
      setPhase("backdrop");
      // Staged cascade
      setTimeout(() => setPhase("card"), 400);
      setTimeout(() => setPhase("content"), 900);
      setTimeout(() => setPhase("ready"), 1600);
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
      // Hero highlight bridge
      const hero = document.querySelector("[data-hero]");
      if (hero) {
        hero.classList.add("hero-arrival-glow");
        setTimeout(() => hero.classList.remove("hero-arrival-glow"), 3000);
      }
    }, 600);
  }

  if (!visible) return null;

  const pastBackdrop = phase !== "backdrop";
  const pastCard = phase === "content" || phase === "ready" || phase === "leaving";
  const isReady = phase === "ready";
  const isLeaving = phase === "leaving";

  return (
    <>
      {/* Backdrop — dark with subtle center glow */}
      <div
        className="fixed inset-0 z-[90]"
        style={{
          transition: "opacity 700ms cubic-bezier(0.16, 1, 0.3, 1)",
          opacity: isLeaving ? 0 : phase !== "hidden" ? 1 : 0,
        }}
        onClick={dismiss}
      >
        <div
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(8,18,16,0.92)" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(45,110,106,0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Card container */}
      <div className="fixed inset-0 z-[91] flex items-center justify-center px-5 pointer-events-none">
        <div
          className="arrival-card pointer-events-auto w-full rounded-2xl relative"
          style={{
            maxWidth: "clamp(340px, 50vw, 520px)",
            padding: "clamp(32px, 4.5vw, 52px)",
            backgroundColor: "#1A2F2B",
            boxShadow: pastBackdrop
              ? "0 0 120px rgba(45,110,106,0.15), 0 0 0 1px rgba(45,110,106,0.12), 0 24px 80px rgba(0,0,0,0.3)"
              : "none",
            opacity: isLeaving ? 0 : pastBackdrop ? 1 : 0,
            transform: isLeaving
              ? "scale(0.96) translateY(-20px)"
              : pastBackdrop
                ? "scale(1) translateY(0)"
                : "scale(0.92) translateY(48px)",
            transition: isLeaving
              ? "opacity 500ms ease-in, transform 500ms ease-in"
              : "opacity 700ms cubic-bezier(0.16, 1, 0.3, 1), transform 700ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 700ms ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ambient glow ring behind card */}
          <div
            className="absolute -inset-px rounded-2xl pointer-events-none"
            style={{
              opacity: isReady ? 1 : 0,
              transition: "opacity 1200ms ease-out",
              boxShadow:
                "inset 0 0 0 1px rgba(45,110,106,0.2), 0 0 60px rgba(45,110,106,0.06)",
            }}
          />

          {/* Label */}
          <p
            className="font-semibold uppercase"
            style={{
              fontSize: "clamp(10px, 1.2vw, 12px)",
              letterSpacing: "0.15em",
              color: "#4A8A82",
              opacity: pastCard ? 1 : 0,
              transform: pastCard ? "translateY(0)" : "translateY(8px)",
              transition:
                "opacity 500ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            Твой помощник
          </p>

          {/* Headline */}
          <p
            className="font-bold leading-tight text-white"
            style={{
              marginTop: "clamp(14px, 2vw, 22px)",
              fontSize: "clamp(24px, 3.2vw, 36px)",
              opacity: pastCard ? 1 : 0,
              transform: pastCard ? "translateY(0)" : "translateY(12px)",
              transition:
                "opacity 600ms cubic-bezier(0.16, 1, 0.3, 1) 120ms, transform 600ms cubic-bezier(0.16, 1, 0.3, 1) 120ms",
            }}
          >
            Ты внутри.
          </p>

          {/* Body — first paragraph */}
          <p
            className="leading-relaxed"
            style={{
              marginTop: "clamp(12px, 1.5vw, 18px)",
              fontSize: "clamp(14px, 1.6vw, 17px)",
              color: "#A0C4BE",
              opacity: pastCard ? 1 : 0,
              transform: pastCard ? "translateY(0)" : "translateY(10px)",
              transition:
                "opacity 500ms cubic-bezier(0.16, 1, 0.3, 1) 280ms, transform 500ms cubic-bezier(0.16, 1, 0.3, 1) 280ms",
            }}
          >
            Здесь дневник, показатели, документы, лекарства —
            всё, что нужно для твоей картины здоровья.
          </p>

          {/* Body — second paragraph */}
          <p
            className="leading-relaxed"
            style={{
              marginTop: "clamp(6px, 1vw, 10px)",
              fontSize: "clamp(14px, 1.6vw, 17px)",
              color: "#A0C4BE",
              opacity: pastCard ? 1 : 0,
              transform: pastCard ? "translateY(0)" : "translateY(10px)",
              transition:
                "opacity 500ms cubic-bezier(0.16, 1, 0.3, 1) 420ms, transform 500ms cubic-bezier(0.16, 1, 0.3, 1) 420ms",
            }}
          >
            Не нужно разбираться во всём сразу. Я подскажу, с чего начать.
          </p>

          {/* CTA button */}
          <button
            type="button"
            onClick={dismiss}
            className="arrival-cta w-full rounded-xl font-semibold text-white transition-transform active:scale-[0.98]"
            style={{
              marginTop: "clamp(24px, 3.5vw, 36px)",
              padding: "clamp(15px, 2vw, 20px)",
              fontSize: "clamp(15px, 1.6vw, 17px)",
              backgroundColor: "#2D6E6A",
              opacity: isReady || isLeaving ? 1 : 0,
              transform:
                isReady || isLeaving ? "translateY(0)" : "translateY(12px)",
              transition:
                "opacity 500ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1)",
              boxShadow: isReady
                ? "0 0 24px rgba(45,110,106,0.25), 0 4px 16px rgba(45,110,106,0.2)"
                : "none",
            }}
          >
            Начнём
          </button>
        </div>
      </div>

      <style>{`
        @keyframes heroGlow {
          0% { box-shadow: 0 0 0 3px rgba(45,110,106,0.6), 0 0 32px rgba(45,110,106,0.2); }
          100% { box-shadow: 0 0 0 0px rgba(45,110,106,0), 0 0 0px rgba(45,110,106,0); }
        }
        .hero-arrival-glow {
          animation: heroGlow 3s ease-out forwards;
        }
        @keyframes ctaPulse {
          0%, 100% { box-shadow: 0 0 24px rgba(45,110,106,0.25), 0 4px 16px rgba(45,110,106,0.2); }
          50% { box-shadow: 0 0 32px rgba(45,110,106,0.35), 0 4px 24px rgba(45,110,106,0.3); }
        }
        .arrival-cta:not(:active) {
          animation: ctaPulse 3s ease-in-out infinite;
          animation-delay: 0.5s;
        }
      `}</style>
    </>
  );
}
