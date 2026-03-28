"use client";

import { useState } from "react";
import Link from "next/link";

// ============================================================
// SHARED MOCK DATA — same across all 3 concepts
// ============================================================
const MOCK = {
  greeting: "Добрый вечер, Никита.",
  observation: "Давление держится выше нормы третий день. Сон стал короче. Стоит зафиксировать, как себя чувствуешь сегодня.",
  nextStep: { text: "Записать самочувствие", sub: "Дневник не обновлялся 2 дня", href: "/diary" },
  modules: [
    { key: "wellbeing", label: "Самочувствие", icon: "♡", status: "7/10 · усталость", detail: "3 записи", href: "/diary", active: true, primary: true },
    { key: "vitals", label: "Показатели", icon: "〜", status: "135/85 мм рт.ст.", detail: "давление повышено", href: "/vitals", active: true, primary: false },
    { key: "medications", label: "Лекарства", icon: "⊕", status: "2 активных", detail: "Лозартан, Аспирин", href: "/medications", active: true, primary: false },
    { key: "documents", label: "Документы", icon: "▤", status: "1 файл", detail: "анализ крови", href: "/documents", active: true, primary: false },
    { key: "symptoms", label: "Симптомы", icon: "◎", status: "головная боль ×3", detail: "за неделю", href: "/symptoms-map", active: true, primary: false },
    { key: "lifestyle", label: "Образ жизни", icon: "↻", status: "сон 6ч", detail: "ниже нормы", href: "/timeline", active: false, primary: false },
    { key: "emotions", label: "Эмоции", icon: "◇", status: "нет данных", detail: null, href: "/emotions", active: false, primary: false },
  ],
  signals: [
    { text: "Давление 135/85 — выше целевого третий день подряд", type: "warning" as const },
    { text: "Головная боль повторяется — 3 эпизода за неделю", type: "warning" as const },
    { text: "Сон 6 часов — при 7+ самочувствие было лучше", type: "info" as const },
    { text: "Лозартан принимается регулярно", type: "ok" as const },
  ],
  gaps: ["Эмоции не отслеживаются", "Нет свежих анализов (>30 дней)", "Вес не фиксируется"],
};

const signalDot = (type: "warning" | "info" | "ok") => {
  if (type === "warning") return { color: "var(--amber)" };
  if (type === "ok") return { color: "var(--accent)" };
  return { color: "var(--text-muted)" };
};

// ============================================================
// CONCEPT 1 — CONSTELLATION HERO
// ============================================================
function Concept1() {
  const hub = MOCK.modules[0]; // wellbeing
  const sats = MOCK.modules.slice(1);

  // Positions for constellation — hub center, sats around
  const positions: Record<string, { left: string; top: string }> = {
    vitals:      { left: "76%", top: "22%" },
    medications: { left: "82%", top: "52%" },
    documents:   { left: "18%", top: "30%" },
    symptoms:    { left: "14%", top: "60%" },
    lifestyle:   { left: "68%", top: "78%" },
    emotions:    { left: "32%", top: "82%" },
  };

  return (
    <div className="space-y-0">
      {/* Hero */}
      <div className="px-5 pt-5 pb-3">
        <p className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>{MOCK.greeting}</p>
        <p className="mt-1 text-[12px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>{MOCK.observation}</p>
      </div>

      {/* Constellation */}
      <div className="relative mx-3" style={{ height: "340px" }}>
        {/* SVG lines — hub to each sat */}
        <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
          {sats.map((s) => {
            const pos = positions[s.key];
            if (!pos) return null;
            return (
              <line key={s.key}
                x1="50" y1="42"
                x2={parseFloat(pos.left)} y2={parseFloat(pos.top)}
                stroke={s.active ? "rgba(45,212,191,0.25)" : "rgba(255,255,255,0.06)"}
                strokeWidth={s.active ? "0.4" : "0.25"}
              />
            );
          })}
        </svg>

        {/* Hub — center */}
        <Link href={hub.href} className="absolute flex flex-col items-center text-center rounded-2xl px-5 py-4 transition-all hover:brightness-110"
          style={{
            left: "50%", top: "42%", transform: "translate(-50%, -50%)",
            backgroundColor: "rgba(45,212,191,0.06)", border: "1px solid rgba(45,212,191,0.25)",
            width: "clamp(150px, 40%, 190px)",
          }}>
          <span className="text-2xl" style={{ color: "var(--accent)" }}>{hub.icon}</span>
          <span className="mt-1 text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>{hub.label}</span>
          <span className="text-[11px]" style={{ color: "var(--accent)" }}>{hub.status}</span>
          {/* Inline signals */}
          <div className="mt-2 space-y-1 w-full text-left">
            {MOCK.signals.slice(0, 2).map((sig, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[9px]">
                <span className="mt-0.5" style={signalDot(sig.type)}>●</span>
                <span style={{ color: "var(--text-muted)" }}>{sig.text}</span>
              </div>
            ))}
          </div>
        </Link>

        {/* Satellite nodes */}
        {sats.map((s) => {
          const pos = positions[s.key];
          if (!pos) return null;
          return (
            <Link key={s.key} href={s.href}
              className="absolute flex flex-col items-center text-center rounded-xl px-2 py-2 transition-all hover:brightness-110"
              style={{
                left: pos.left, top: pos.top, transform: "translate(-50%, -50%)",
                backgroundColor: s.active ? "rgba(45,212,191,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${s.active ? "rgba(45,212,191,0.15)" : "rgba(255,255,255,0.06)"}`,
                width: "clamp(72px, 20%, 90px)",
              }}>
              <span className="text-sm" style={{ color: s.active ? "var(--accent)" : "rgba(255,255,255,0.3)" }}>{s.icon}</span>
              <span className="mt-0.5 text-[10px] font-bold" style={{ color: s.active ? "var(--text-primary)" : "rgba(255,255,255,0.4)" }}>{s.label}</span>
              <span className="text-[8px]" style={{ color: s.active ? "var(--accent)" : "rgba(255,255,255,0.25)" }}>{s.status}</span>
            </Link>
          );
        })}
      </div>

      {/* Action */}
      <div className="px-5 pb-5">
        <Link href={MOCK.nextStep.href} className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:brightness-110"
          style={{ backgroundColor: "rgba(45,212,191,0.06)", border: "1px solid rgba(45,212,191,0.20)" }}>
          <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
            style={{ backgroundColor: "rgba(45,212,191,0.14)", color: "var(--accent)" }}>→</span>
          <div>
            <p className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>{MOCK.nextStep.text}</p>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{MOCK.nextStep.sub}</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// CONCEPT 2 — CONTROL PANEL
// ============================================================
function Concept2() {
  return (
    <div className="px-4 pt-5 pb-5 space-y-3">
      {/* Hero */}
      <div>
        <p className="text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>{MOCK.greeting}</p>
        <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>{MOCK.observation}</p>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-5 gap-3">
        {/* LEFT: State panel (3/5) */}
        <div className="col-span-3 space-y-2">
          {/* Main state card */}
          <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(45,212,191,0.05)", border: "1px solid rgba(45,212,191,0.20)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg" style={{ color: "var(--accent)" }}>♡</span>
                <span className="text-[14px] font-bold" style={{ color: "var(--text-primary)" }}>Общее состояние</span>
              </div>
              <span className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>набирается картина</span>
            </div>
            <div className="mt-3 space-y-1.5">
              {MOCK.signals.map((sig, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <span className="mt-0.5 shrink-0" style={signalDot(sig.type)}>●</span>
                  <span style={{ color: "var(--text-muted)" }}>{sig.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Agent gaps block */}
          <div className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)", opacity: 0.5 }}>Чего не хватает</p>
            <div className="mt-2 space-y-1">
              {MOCK.gaps.map((g, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>○</span>
                  <span style={{ color: "var(--text-muted)" }}>{g}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Link href={MOCK.nextStep.href} className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:brightness-110"
            style={{ backgroundColor: "rgba(45,212,191,0.06)", border: "1px solid rgba(45,212,191,0.20)" }}>
            <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
              style={{ backgroundColor: "rgba(45,212,191,0.14)", color: "var(--accent)" }}>→</span>
            <div>
              <p className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>{MOCK.nextStep.text}</p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{MOCK.nextStep.sub}</p>
            </div>
          </Link>
        </div>

        {/* RIGHT: Module cards (2/5) */}
        <div className="col-span-2 space-y-2">
          {MOCK.modules.filter(m => m.key !== "wellbeing").map((m) => (
            <Link key={m.key} href={m.href}
              className="block rounded-xl px-3 py-2.5 transition-all hover:brightness-110"
              style={{
                backgroundColor: m.active ? "rgba(45,212,191,0.04)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${m.active ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.05)"}`,
              }}>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: m.active ? "var(--accent)" : "rgba(255,255,255,0.25)" }}>{m.icon}</span>
                <span className="text-[11px] font-bold" style={{ color: m.active ? "var(--text-primary)" : "rgba(255,255,255,0.4)" }}>{m.label}</span>
              </div>
              <p className="mt-0.5 text-[10px]" style={{ color: m.active ? "var(--text-muted)" : "rgba(255,255,255,0.25)" }}>
                {m.status}{m.detail ? ` · ${m.detail}` : ""}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CONCEPT 3 — HYBRID MAP + PANELS (refined)
// ============================================================
function Concept3() {
  const core = MOCK.modules.filter(m => m.primary || ["vitals", "medications"].includes(m.key));
  const supporting = MOCK.modules.filter(m => !m.primary && !["vitals", "medications"].includes(m.key));
  const activeSupporting = supporting.filter(m => m.active);
  const emptySupporting = supporting.filter(m => !m.active);

  return (
    <div className="px-4 pt-5 pb-5 space-y-0">
      {/* ── Hero ── */}
      <div className="pb-4">
        <p className="text-[19px] font-bold leading-[1.25]" style={{ color: "var(--text-primary)" }}>{MOCK.greeting}</p>
        <p className="mt-1.5 text-[12px] leading-[1.55]" style={{ color: "var(--text-muted)" }}>{MOCK.observation}</p>
      </div>

      {/* ── CORE INTELLIGENCE BLOCK ── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(45,212,191,0.14)" }}
      >
        {/* Subtle top accent line */}
        <div className="h-[2px]" style={{ background: "linear-gradient(90deg, rgba(45,212,191,0.4) 0%, rgba(45,212,191,0.08) 100%)" }} />

        <div className="p-4 pb-3" style={{ backgroundColor: "rgba(45,212,191,0.025)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--accent)", opacity: 0.5 }}>
              Ядро наблюдения
            </p>
            <span className="text-[10px]" style={{ color: "var(--accent)", opacity: 0.35 }}>
              3 из 7 модулей активны
            </span>
          </div>

          {/* 3-col core modules — each with richer content */}
          <div className="grid grid-cols-3 gap-2">
            {core.map((m, idx) => (
              <Link key={m.key} href={m.href}
                className="relative rounded-xl px-3 py-3 transition-all hover:brightness-110"
                style={{
                  backgroundColor: "rgba(45,212,191,0.05)",
                  border: "1px solid rgba(45,212,191,0.18)",
                }}>
                {/* Primary badge for wellbeing */}
                {idx === 0 && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)", boxShadow: "0 0 6px rgba(45,212,191,0.5)" }} />
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-base" style={{ color: "var(--accent)" }}>{m.icon}</span>
                  <span className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>{m.label}</span>
                </div>
                <p className="text-[11px] font-medium" style={{ color: "var(--accent)" }}>{m.status}</p>
                {m.detail && <p className="mt-0.5 text-[9px]" style={{ color: "var(--text-muted)" }}>{m.detail}</p>}
              </Link>
            ))}
          </div>
        </div>

        {/* Signals zone — inside core block, separated visually */}
        <div className="px-4 py-3" style={{ backgroundColor: "rgba(0,0,0,0.15)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "var(--text-muted)", opacity: 0.4 }}>
            Сигналы агента
          </p>
          <div className="space-y-1.5">
            {MOCK.signals.map((sig, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-[3px] shrink-0 h-[6px] w-[6px] rounded-full" style={{ backgroundColor: signalDot(sig.type).color }} />
                <span className="text-[11px] leading-[1.4]" style={{ color: sig.type === "warning" ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {sig.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA integrated into core block bottom */}
        <Link
          href={MOCK.nextStep.href}
          className="flex items-center gap-3 px-4 py-3 transition-all hover:brightness-125"
          style={{ backgroundColor: "rgba(45,212,191,0.06)", borderTop: "1px solid rgba(45,212,191,0.12)" }}
        >
          <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold"
            style={{ backgroundColor: "rgba(45,212,191,0.15)", color: "var(--accent)" }}>→</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>{MOCK.nextStep.text}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{MOCK.nextStep.sub}</p>
          </div>
          <span className="text-xs" style={{ color: "var(--accent)", opacity: 0.3 }}>→</span>
        </Link>
      </div>

      {/* ── SUPPORTING MODULES ── */}
      <div className="pt-3 space-y-2">
        {/* Active supporting — richer cards with left accent */}
        {activeSupporting.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {activeSupporting.map((m) => (
              <Link key={m.key} href={m.href}
                className="relative rounded-xl overflow-hidden transition-all hover:brightness-110"
                style={{ backgroundColor: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {/* Left accent bar — visual connection to core */}
                <div className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full" style={{ backgroundColor: "rgba(45,212,191,0.2)" }} />
                <div className="pl-4 pr-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs" style={{ color: "var(--accent)", opacity: 0.6 }}>{m.icon}</span>
                    <span className="text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>{m.label}</span>
                  </div>
                  <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {m.status}{m.detail ? ` · ${m.detail}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Empty supporting + gaps — merged into one low-priority row */}
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-4 flex-wrap">
            {emptySupporting.map((m) => (
              <Link key={m.key} href={m.href} className="flex items-center gap-1.5 transition-all hover:brightness-125">
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>{m.icon}</span>
                <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>{m.label}</span>
                <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.18)" }}>{m.status}</span>
              </Link>
            ))}
          </div>
          <div className="mt-2 pt-2 flex flex-wrap gap-x-3 gap-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}>
            <span className="text-[9px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)", opacity: 0.3 }}>не хватает:</span>
            {MOCK.gaps.map((g, i) => (
              <span key={i} className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>{g}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SWITCHER
// ============================================================
const concepts = [
  { id: 1, name: "Constellation", component: Concept1 },
  { id: 2, name: "Control Panel", component: Concept2 },
  { id: 3, name: "Hybrid", component: Concept3 },
];

export function VisualExplore({ variant }: { variant?: number }) {
  const [active, setActive] = useState(variant ?? 3);
  const ActiveConcept = concepts.find((c) => c.id === active)?.component ?? Concept1;

  return (
    <div>
      {/* Switcher bar */}
      <div className="flex gap-1 px-4 pt-3 pb-1">
        {concepts.map((c) => (
          <button
            key={c.id}
            onClick={() => setActive(c.id)}
            className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all"
            style={{
              backgroundColor: active === c.id ? "rgba(45,212,191,0.12)" : "transparent",
              color: active === c.id ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${active === c.id ? "rgba(45,212,191,0.25)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {c.id}. {c.name}
          </button>
        ))}
      </div>
      <ActiveConcept />
    </div>
  );
}
