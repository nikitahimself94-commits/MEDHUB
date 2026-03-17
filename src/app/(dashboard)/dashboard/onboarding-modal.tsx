"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STORAGE_KEY = "medhub_onboarding_seen";

export function OnboardingModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, []);

  function handleClose() {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="w-full max-w-md rounded-2xl p-5 sm:p-8 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: "#FAFBFB" }}
      >
        <h2
          className="text-xl font-bold tracking-wide"
          style={{ color: "#1A2F2B" }}
        >
          Добро пожаловать в MEDHUB
        </h2>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "#3D6B62" }}>
          Это ваш личный медицинский помощник. Здесь вы храните данные о здоровье,
          отслеживаете состояние и готовитесь к визитам к врачу — всё в одном месте.
        </p>

        <div className="mt-5">
          <p className="text-sm font-semibold" style={{ color: "#1A2F2B" }}>
            С чего начать:
          </p>
          <ol className="mt-2 space-y-2 text-sm" style={{ color: "#3D6B62" }}>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold" style={{ color: "#2D6E6A" }}>1.</span>
              <span>
                <Link href="/profile" className="font-medium underline" style={{ color: "#2D6E6A" }}>Заполните карточку</Link>
                {" "}— группа крови, аллергии, хронические заболевания
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold" style={{ color: "#2D6E6A" }}>2.</span>
              <span>
                <Link href="/medications" className="font-medium underline" style={{ color: "#2D6E6A" }}>Добавьте лекарства</Link>
                {" "}— текущие препараты и расписание приёма
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold" style={{ color: "#2D6E6A" }}>3.</span>
              <span>
                <Link href="/diary" className="font-medium underline" style={{ color: "#2D6E6A" }}>Ведите дневник</Link>
                {" "}— записывайте самочувствие, симптомы, сон
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold" style={{ color: "#2D6E6A" }}>4.</span>
              <span>
                <Link href="/documents" className="font-medium underline" style={{ color: "#2D6E6A" }}>Загружайте документы</Link>
                {" "}— результаты анализов, заключения, снимки
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold" style={{ color: "#2D6E6A" }}>5.</span>
              <span>
                <Link href="/ai-chat" className="font-medium underline" style={{ color: "#2D6E6A" }}>Используйте AI</Link>
                {" "}— когда появятся данные, AI поможет разобраться
              </span>
            </li>
          </ol>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="mt-6 w-full rounded-xl py-3 text-sm font-semibold text-white transition-all hover:shadow-lg active:scale-[0.98]"
          style={{ backgroundColor: "#2D6E6A" }}
        >
          Понятно, начать
        </button>
      </div>
    </div>
  );
}
