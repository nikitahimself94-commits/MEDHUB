"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "medhub:arrival_shown";
const DELAY_MS = 1500;

/**
 * First Arrival Overlay — shows once after onboarding completion.
 * Appears with a delay, dims the background, agent presence card.
 * After dismiss, sets localStorage flag so it never shows again.
 */
export function FirstArrivalOverlay({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    if (!show) return;

    // Check if already shown in this browser
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return; // localStorage unavailable
    }

    const timer = setTimeout(() => {
      setVisible(true);
      // Trigger fade-in on next frame
      requestAnimationFrame(() => setFadeIn(true));
    }, DELAY_MS);

    return () => clearTimeout(timer);
  }, [show]);

  function dismiss() {
    setFadeIn(false);
    setTimeout(() => {
      setVisible(false);
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
    }, 300);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-6 transition-opacity duration-300"
      style={{
        backgroundColor: "rgba(15,31,29,0.75)",
        opacity: fadeIn ? 1 : 0,
      }}
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 transition-all duration-300"
        style={{
          backgroundColor: "#1A2F2B",
          transform: fadeIn ? "translateY(0)" : "translateY(12px)",
          opacity: fadeIn ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.15em]"
          style={{ color: "#4A8A82" }}
        >
          Ваш помощник
        </p>

        <p className="mt-3 text-[18px] font-bold leading-snug text-white">
          Добро пожаловать в рабочее пространство.
        </p>

        <p
          className="mt-2 text-[14px] leading-relaxed"
          style={{ color: "#A0C4BE" }}
        >
          Здесь собраны все инструменты. Я буду рядом — подсказывать,
          что делать дальше, и держать вашу картину целиком.
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-xl px-6 py-3.5 text-[15px] font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
          style={{ backgroundColor: "#2D6E6A" }}
        >
          Хорошо
        </button>
      </div>
    </div>
  );
}
