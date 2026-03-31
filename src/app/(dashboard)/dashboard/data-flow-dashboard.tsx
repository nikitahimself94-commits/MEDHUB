"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createConcern, clearConcern, updateConcernStatus } from "./concern-actions";
import { generateHypothesisForConcern, regenerateHypothesisForConcern, clearHypothesisForConcern } from "./hypothesis-actions";

// ============================================================
// DEMO STATE TYPE
// ============================================================
export type DemoState = "low_data" | "concern_no_hypothesis" | "emerging" | "plausible" | "supported" | "weakened" | "deprioritized" | "unresolved" | "urgent review needed";
const DEMO_STATES: DemoState[] = ["low_data", "concern_no_hypothesis", "emerging", "plausible", "supported", "weakened", "deprioritized", "unresolved", "urgent review needed"];
const DEFAULT_DEMO_STATE: DemoState = "supported";

// ============================================================
// TYPES
// ============================================================
interface Domain {
  key: string;
  icon: string;
  label: string;
  status: string;
  updated: string | null;
  fill: number;
  contributes: boolean;
  href: string;
}

interface EvidenceItem {
  text: string;
  domain: string;
}

interface MissingItem {
  text: string;
  targetHref: string;
  sourceDomain?: string; // module label for traceability
}

interface StateData {
  agent: { greeting: string; observation: string };
  concern: { name: string; question: string } | null;
  hypothesis: { text: string; state: string } | null;
  supporting: EvidenceItem[];
  weakening: EvidenceItem[];
  missing: MissingItem[];
  nextAction: { text: string; reason: string; href: string };
  coreDomains: Domain[];
  contextDomains: Domain[];
}

// Real domain data passed from server
export interface RealDomainData {
  [key: string]: { status: string; updated: string | null; fill: number };
}

// Server-computed meta for top context + next action + missing evidence base
export interface ServerMeta {
  greeting: string;
  observation: string;
  nextAction: { text: string; reason: string; href: string };
  missingDomains: string[];
  missingItems: MissingItem[];
  activeDomainLabels: string[];
  dataSnapshot: { text: string; href: string }[]; // 2–4 factual signal lines with source links
}

// ============================================================
// PER-STATE HARDCODED DATA
// ============================================================

const STATES: Record<DemoState, StateData> = {
  low_data: {
    agent: {
      greeting: "Добрый вечер, Никита.",
      observation: "Для начала укажите, что вас беспокоит, и заполните базовый профиль.",
    },
    concern: null,
    hypothesis: null,
    supporting: [],
    weakening: [],
    missing: [
      { text: "Нет базового контекста — пол, возраст, диагнозы", targetHref: "/profile" },
      { text: "Нет ни одного симптома или показателя", targetHref: "/diary" },
      { text: "Нет цели наблюдения", targetHref: "/diary" },
    ],
    nextAction: {
      text: "Заполнить базовый профиль",
      reason: "Без базового контекста агент анализирует фрагменты, а не человека",
      href: "/profile",
    },
    coreDomains: [
      { key: "symptoms", icon: "◎", label: "Симптомы", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/symptoms-map" },
      { key: "vitals", icon: "〜", label: "Показатели", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/vitals" },
      { key: "medications", icon: "⊕", label: "Лекарства", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/medications" },
      { key: "documents", icon: "▤", label: "Документы", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/documents" },
      { key: "timeline", icon: "⊞", label: "Хронология", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/timeline" },
      { key: "baseline", icon: "□", label: "Анамнез", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/profile" },
    ],
    contextDomains: [
      { key: "wellbeing", icon: "♡", label: "Самочувствие", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/diary" },
      { key: "lifestyle", icon: "↻", label: "Образ жизни", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/timeline" },
      { key: "emotions", icon: "◇", label: "Эмоции", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/emotions" },
      { key: "triggers", icon: "⚡", label: "Триггеры", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/diary" },
    ],
  },

  concern_no_hypothesis: {
    agent: {
      greeting: "Добрый вечер, Никита.",
      observation: "Собираю картину по вашему наблюдению. Нужно ещё несколько точек данных.",
    },
    concern: {
      name: "Повторяющиеся головные боли",
      question: "Что может вызывать головные боли?",
    },
    hypothesis: null,
    supporting: [],
    weakening: [],
    missing: [
      { text: "Нужны измерения давления в моменты боли", targetHref: "/vitals" },
      { text: "Нет данных по триггерам — еда, стресс, сон", targetHref: "/diary" },
      { text: "Нет свежих анализов", targetHref: "/documents" },
    ],
    nextAction: {
      text: "Записать 3 измерения давления",
      reason: "Покажет, совпадает ли давление с эпизодами боли",
      href: "/vitals",
    },
    coreDomains: [
      { key: "symptoms", icon: "◎", label: "Симптомы", status: "головная боль ×2", updated: "вчера", fill: 0.3, contributes: false, href: "/symptoms-map" },
      { key: "vitals", icon: "〜", label: "Показатели", status: "1 измерение", updated: "3 дня", fill: 0.1, contributes: false, href: "/vitals" },
      { key: "medications", icon: "⊕", label: "Лекарства", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/medications" },
      { key: "documents", icon: "▤", label: "Документы", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/documents" },
      { key: "timeline", icon: "⊞", label: "Хронология", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/timeline" },
      { key: "baseline", icon: "□", label: "Анамнез", status: "заполнен", updated: null, fill: 0.4, contributes: false, href: "/profile" },
    ],
    contextDomains: [
      { key: "wellbeing", icon: "♡", label: "Самочувствие", status: "6/10", updated: "вчера", fill: 0.4, contributes: false, href: "/diary" },
      { key: "lifestyle", icon: "↻", label: "Образ жизни", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/timeline" },
      { key: "emotions", icon: "◇", label: "Эмоции", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/emotions" },
      { key: "triggers", icon: "⚡", label: "Триггеры", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/diary" },
    ],
  },

  emerging: {
    agent: {
      greeting: "Добрый вечер, Никита.",
      observation: "Появляется ранняя рабочая нить. Нужно больше данных для уточнения.",
    },
    concern: {
      name: "Повторяющиеся головные боли",
      question: "Связаны ли боли с повышенным давлением?",
    },
    hypothesis: {
      text: "Возможная связь головных болей с повышенным артериальным давлением — пока ранняя нить",
      state: "emerging",
    },
    supporting: [
      { text: "Давление 130/88 при двух из трёх измерений", domain: "Показатели" },
    ],
    weakening: [],
    missing: [
      { text: "Нужны измерения давления в момент головной боли", targetHref: "/vitals" },
      { text: "Нет данных по лекарствам", targetHref: "/medications" },
      { text: "Нет свежих анализов", targetHref: "/documents" },
    ],
    nextAction: {
      text: "Измерить давление при следующей головной боли",
      reason: "Подтвердит или опровергнет временную связь боли и давления",
      href: "/vitals",
    },
    coreDomains: [
      { key: "symptoms", icon: "◎", label: "Симптомы", status: "головная боль ×3", updated: "вчера", fill: 0.4, contributes: true, href: "/symptoms-map" },
      { key: "vitals", icon: "〜", label: "Показатели", status: "130/88", updated: "сегодня", fill: 0.3, contributes: true, href: "/vitals" },
      { key: "medications", icon: "⊕", label: "Лекарства", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/medications" },
      { key: "documents", icon: "▤", label: "Документы", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/documents" },
      { key: "timeline", icon: "⊞", label: "Хронология", status: "2 события", updated: "вчера", fill: 0.2, contributes: false, href: "/timeline" },
      { key: "baseline", icon: "□", label: "Анамнез", status: "заполнен", updated: null, fill: 0.4, contributes: false, href: "/profile" },
    ],
    contextDomains: [
      { key: "wellbeing", icon: "♡", label: "Самочувствие", status: "6/10", updated: "вчера", fill: 0.5, contributes: false, href: "/diary" },
      { key: "lifestyle", icon: "↻", label: "Образ жизни", status: "сон 6ч", updated: "2 дня", fill: 0.15, contributes: false, href: "/timeline" },
      { key: "emotions", icon: "◇", label: "Эмоции", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/emotions" },
      { key: "triggers", icon: "⚡", label: "Триггеры", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/diary" },
    ],
  },

  supported: {
    agent: {
      greeting: "Добрый вечер, Никита.",
      observation: "Давление держится выше нормы. Есть паттерн, который стоит обсудить с врачом.",
    },
    concern: {
      name: "Повторяющиеся головные боли",
      question: "Связаны ли боли с устойчиво повышенным давлением?",
    },
    hypothesis: {
      text: "Головные боли могут быть связаны с устойчиво повышенным артериальным давлением",
      state: "supported",
    },
    supporting: [
      { text: "Давление 135/85 — выше целевого третий день подряд", domain: "Показатели" },
      { text: "Головная боль совпадает с пиками давления по времени", domain: "Симптомы" },
    ],
    weakening: [
      { text: "Лозартан принимается регулярно — давление должно быть под контролем", domain: "Лекарства" },
    ],
    missing: [
      { text: "Нет свежих анализов (>30 дней)", targetHref: "/documents" },
      { text: "Мало данных по триггерам головной боли", targetHref: "/diary" },
    ],
    nextAction: {
      text: "Загрузить свежий анализ крови",
      reason: "Поможет проверить, нет ли вторичных причин повышенного давления",
      href: "/documents",
    },
    coreDomains: [
      { key: "symptoms", icon: "◎", label: "Симптомы", status: "головная боль ×3", updated: "вчера", fill: 0.5, contributes: true, href: "/symptoms-map" },
      { key: "vitals", icon: "〜", label: "Показатели", status: "135/85", updated: "сегодня", fill: 0.6, contributes: true, href: "/vitals" },
      { key: "medications", icon: "⊕", label: "Лекарства", status: "2 активных", updated: "3 дня", fill: 0.8, contributes: true, href: "/medications" },
      { key: "documents", icon: "▤", label: "Документы", status: "1 файл", updated: "32 дня", fill: 0.3, contributes: false, href: "/documents" },
      { key: "timeline", icon: "⊞", label: "Хронология", status: "4 события", updated: "вчера", fill: 0.35, contributes: false, href: "/timeline" },
      { key: "baseline", icon: "□", label: "Анамнез", status: "заполнен", updated: null, fill: 0.4, contributes: false, href: "/profile" },
    ],
    contextDomains: [
      { key: "wellbeing", icon: "♡", label: "Самочувствие", status: "7/10", updated: "вчера", fill: 0.7, contributes: true, href: "/diary" },
      { key: "lifestyle", icon: "↻", label: "Образ жизни", status: "сон 6ч", updated: "2 дня", fill: 0.15, contributes: false, href: "/timeline" },
      { key: "emotions", icon: "◇", label: "Эмоции", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/emotions" },
      { key: "triggers", icon: "⚡", label: "Триггеры", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/diary" },
    ],
  },

  // Plausible — dev preview only (real hypothesis overrides this)
  plausible: {
    agent: { greeting: "Добрый вечер, Никита.", observation: "Гипотеза правдоподобна. Есть несколько согласованных сигналов." },
    concern: { name: "Повторяющиеся головные боли", question: "Связаны ли боли с повышенным давлением?" },
    hypothesis: { text: "Головные боли могут быть связаны с повышенным артериальным давлением", state: "plausible" },
    supporting: [
      { text: "Давление 135/85 — выше целевого третий день", domain: "Показатели" },
      { text: "Головная боль совпадает с пиками давления", domain: "Симптомы" },
    ],
    weakening: [],
    missing: [
      { text: "Нет свежих анализов (>30 дней)", targetHref: "/documents" },
      { text: "Мало данных по триггерам", targetHref: "/diary" },
    ],
    nextAction: { text: "Загрузить свежий анализ", reason: "Усилит или ослабит текущую гипотезу", href: "/documents" },
    coreDomains: [
      { key: "symptoms", icon: "◎", label: "Симптомы", status: "головная боль ×3", updated: "вчера", fill: 0.5, contributes: true, href: "/diary" },
      { key: "vitals", icon: "〜", label: "Показатели", status: "135/85", updated: "сегодня", fill: 0.6, contributes: true, href: "/vitals" },
      { key: "medications", icon: "⊕", label: "Лекарства", status: "2 активных", updated: "3 дня", fill: 0.8, contributes: false, href: "/medications" },
      { key: "documents", icon: "▤", label: "Документы", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/documents" },
      { key: "timeline", icon: "⊞", label: "Хронология", status: "4 события", updated: "вчера", fill: 0.35, contributes: false, href: "/timeline" },
      { key: "baseline", icon: "□", label: "Анамнез", status: "заполнен", updated: null, fill: 0.4, contributes: false, href: "/profile" },
    ],
    contextDomains: [
      { key: "wellbeing", icon: "♡", label: "Самочувствие", status: "7/10", updated: "вчера", fill: 0.7, contributes: false, href: "/diary" },
      { key: "lifestyle", icon: "↻", label: "Образ жизни", status: "сон 6ч", updated: "2 дня", fill: 0.15, contributes: false, href: "/timeline" },
      { key: "emotions", icon: "◇", label: "Эмоции", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/emotions" },
      { key: "triggers", icon: "⚡", label: "Триггеры", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/diary" },
    ],
  },

  // Weakened — dev preview only
  weakened: {
    agent: { greeting: "Добрый вечер, Никита.", observation: "Появились данные, которые ослабляют текущую гипотезу." },
    concern: { name: "Повторяющиеся головные боли", question: "Связаны ли боли с повышенным давлением?" },
    hypothesis: { text: "Головные боли могут быть связаны с повышенным артериальным давлением", state: "weakened" },
    supporting: [
      { text: "Давление 135/85 — выше целевого", domain: "Показатели" },
    ],
    weakening: [
      { text: "Лозартан принимается регулярно — давление должно быть под контролем", domain: "Лекарства" },
      { text: "Головная боль возникает и при нормальном давлении", domain: "Симптомы" },
    ],
    missing: [
      { text: "Нужны измерения давления в момент боли", targetHref: "/vitals" },
      { text: "Нет данных по триггерам", targetHref: "/diary" },
    ],
    nextAction: { text: "Измерить давление при следующей боли", reason: "Разрешит противоречие между давлением и болью", href: "/vitals" },
    coreDomains: [
      { key: "symptoms", icon: "◎", label: "Симптомы", status: "головная боль ×3", updated: "вчера", fill: 0.5, contributes: true, href: "/diary" },
      { key: "vitals", icon: "〜", label: "Показатели", status: "135/85", updated: "сегодня", fill: 0.6, contributes: true, href: "/vitals" },
      { key: "medications", icon: "⊕", label: "Лекарства", status: "2 активных", updated: "3 дня", fill: 0.8, contributes: true, href: "/medications" },
      { key: "documents", icon: "▤", label: "Документы", status: "1 файл", updated: "32 дня", fill: 0.3, contributes: false, href: "/documents" },
      { key: "timeline", icon: "⊞", label: "Хронология", status: "4 события", updated: "вчера", fill: 0.35, contributes: false, href: "/timeline" },
      { key: "baseline", icon: "□", label: "Анамнез", status: "заполнен", updated: null, fill: 0.4, contributes: false, href: "/profile" },
    ],
    contextDomains: [
      { key: "wellbeing", icon: "♡", label: "Самочувствие", status: "7/10", updated: "вчера", fill: 0.7, contributes: false, href: "/diary" },
      { key: "lifestyle", icon: "↻", label: "Образ жизни", status: "сон 6ч", updated: "2 дня", fill: 0.15, contributes: false, href: "/timeline" },
      { key: "emotions", icon: "◇", label: "Эмоции", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/emotions" },
      { key: "triggers", icon: "⚡", label: "Триггеры", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/diary" },
    ],
  },

  // Deprioritized — dev preview only (reuses unresolved shape)
  deprioritized: {
    agent: { greeting: "Добрый вечер, Никита.", observation: "Эта гипотеза отложена — фокус переключён." },
    concern: { name: "Повторяющиеся головные боли", question: "Связаны ли боли с повышенным давлением?" },
    hypothesis: { text: "Связь головных болей с повышенным давлением отложена для повторного рассмотрения", state: "deprioritized" },
    supporting: [
      { text: "Давление немного выше нормы", domain: "Показатели" },
    ],
    weakening: [],
    missing: [
      { text: "Нужны измерения давления при головной боли", targetHref: "/vitals" },
      { text: "Нет данных по триггерам", targetHref: "/diary" },
    ],
    nextAction: { text: "Добавить записи в дневник", reason: "Можно вернуться к гипотезе позже", href: "/diary" },
    coreDomains: [
      { key: "symptoms", icon: "◎", label: "Симптомы", status: "головная боль ×2", updated: "5 дн. назад", fill: 0.3, contributes: true, href: "/diary" },
      { key: "vitals", icon: "〜", label: "Показатели", status: "130/85", updated: "5 дн. назад", fill: 0.2, contributes: true, href: "/vitals" },
      { key: "medications", icon: "⊕", label: "Лекарства", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/medications" },
      { key: "documents", icon: "▤", label: "Документы", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/documents" },
      { key: "timeline", icon: "⊞", label: "Хронология", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/timeline" },
      { key: "baseline", icon: "□", label: "Анамнез", status: "заполнен", updated: null, fill: 0.4, contributes: false, href: "/profile" },
    ],
    contextDomains: [
      { key: "wellbeing", icon: "♡", label: "Самочувствие", status: "6/10", updated: "5 дн. назад", fill: 0.4, contributes: false, href: "/diary" },
      { key: "lifestyle", icon: "↻", label: "Образ жизни", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/timeline" },
      { key: "emotions", icon: "◇", label: "Эмоции", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/emotions" },
      { key: "triggers", icon: "⚡", label: "Триггеры", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/diary" },
    ],
  },

  // Urgent review needed — dev preview only
  "urgent review needed": {
    agent: { greeting: "Добрый вечер, Никита.", observation: "Гипотеза требует срочного пересмотра." },
    concern: { name: "Повторяющиеся головные боли", question: "Связаны ли боли с повышенным давлением?" },
    hypothesis: { text: "Связь головных болей с давлением требует срочного пересмотра — появились критичные данные", state: "urgent review needed" },
    supporting: [
      { text: "Давление 135/85 — выше целевого", domain: "Показатели" },
    ],
    weakening: [
      { text: "Головная боль возникает и при нормальном давлении", domain: "Симптомы" },
    ],
    missing: [
      { text: "Нужны измерения давления в момент боли", targetHref: "/vitals" },
      { text: "Нет свежих анализов", targetHref: "/documents" },
    ],
    nextAction: { text: "Измерить давление при следующей боли", reason: "Срочно нужны данные для пересмотра", href: "/vitals" },
    coreDomains: [
      { key: "symptoms", icon: "◎", label: "Симптомы", status: "головная боль ×3", updated: "вчера", fill: 0.5, contributes: true, href: "/diary" },
      { key: "vitals", icon: "〜", label: "Показатели", status: "135/85", updated: "сегодня", fill: 0.6, contributes: true, href: "/vitals" },
      { key: "medications", icon: "⊕", label: "Лекарства", status: "2 активных", updated: "3 дня", fill: 0.8, contributes: true, href: "/medications" },
      { key: "documents", icon: "▤", label: "Документы", status: "1 файл", updated: "32 дня", fill: 0.3, contributes: false, href: "/documents" },
      { key: "timeline", icon: "⊞", label: "Хронология", status: "4 события", updated: "вчера", fill: 0.35, contributes: false, href: "/timeline" },
      { key: "baseline", icon: "□", label: "Анамнез", status: "заполнен", updated: null, fill: 0.4, contributes: false, href: "/profile" },
    ],
    contextDomains: [
      { key: "wellbeing", icon: "♡", label: "Самочувствие", status: "7/10", updated: "вчера", fill: 0.7, contributes: false, href: "/diary" },
      { key: "lifestyle", icon: "↻", label: "Образ жизни", status: "сон 6ч", updated: "2 дня", fill: 0.15, contributes: false, href: "/timeline" },
      { key: "emotions", icon: "◇", label: "Эмоции", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/emotions" },
      { key: "triggers", icon: "⚡", label: "Триггеры", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/diary" },
    ],
  },

  // Unresolved — dev preview only
  unresolved: {
    agent: { greeting: "Добрый вечер, Никита.", observation: "Данных пока недостаточно для вывода в любую сторону." },
    concern: { name: "Повторяющиеся головные боли", question: "Связаны ли боли с повышенным давлением?" },
    hypothesis: { text: "Связь головных болей с повышенным давлением пока не подтверждена и не опровергнута", state: "unresolved" },
    supporting: [
      { text: "Давление немного выше нормы", domain: "Показатели" },
    ],
    weakening: [],
    missing: [
      { text: "Нужны измерения давления при головной боли", targetHref: "/vitals" },
      { text: "Нет данных по триггерам — стресс, сон, еда", targetHref: "/diary" },
      { text: "Нет свежих анализов", targetHref: "/documents" },
    ],
    nextAction: { text: "Добавить записи в дневник", reason: "Больше данных поможет двинуться к выводу", href: "/diary" },
    coreDomains: [
      { key: "symptoms", icon: "◎", label: "Симптомы", status: "головная боль ×2", updated: "5 дн. назад", fill: 0.3, contributes: true, href: "/diary" },
      { key: "vitals", icon: "〜", label: "Показатели", status: "130/85", updated: "5 дн. назад", fill: 0.2, contributes: true, href: "/vitals" },
      { key: "medications", icon: "⊕", label: "Лекарства", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/medications" },
      { key: "documents", icon: "▤", label: "Документы", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/documents" },
      { key: "timeline", icon: "⊞", label: "Хронология", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/timeline" },
      { key: "baseline", icon: "□", label: "Анамнез", status: "заполнен", updated: null, fill: 0.4, contributes: false, href: "/profile" },
    ],
    contextDomains: [
      { key: "wellbeing", icon: "♡", label: "Самочувствие", status: "6/10", updated: "5 дн. назад", fill: 0.4, contributes: false, href: "/diary" },
      { key: "lifestyle", icon: "↻", label: "Образ жизни", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/timeline" },
      { key: "emotions", icon: "◇", label: "Эмоции", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/emotions" },
      { key: "triggers", icon: "⚡", label: "Триггеры", status: "нет данных", updated: null, fill: 0, contributes: false, href: "/diary" },
    ],
  },
};

// ============================================================
// STATIC DOMAIN DEFINITIONS (icon, label, href never change)
// ============================================================
const DOMAIN_DEFS: Record<string, { icon: string; label: string; href: string }> = {
  symptoms:    { icon: "◎", label: "Симптомы", href: "/diary" },
  vitals:      { icon: "〜", label: "Показатели", href: "/vitals" },
  medications: { icon: "⊕", label: "Лекарства", href: "/medications" },
  documents:   { icon: "▤", label: "Документы", href: "/documents" },
  timeline:    { icon: "⊞", label: "Хронология", href: "/timeline" },
  baseline:    { icon: "□", label: "Анамнез", href: "/profile" },
  wellbeing:   { icon: "♡", label: "Самочувствие", href: "/diary" },
  lifestyle:   { icon: "↻", label: "Образ жизни", href: "/timeline" },
  emotions:    { icon: "◇", label: "Эмоции", href: "/emotions" },
  triggers:    { icon: "⚡", label: "Триггеры", href: "/diary" },
};

const CORE_KEYS = ["symptoms", "vitals", "medications", "documents", "timeline", "baseline"];
const CONTEXT_KEYS = ["wellbeing", "lifestyle", "emotions", "triggers"];

function buildDomains(
  keys: string[],
  realData: RealDomainData | undefined,
  syntheticDomains: Domain[],
): Domain[] {
  return keys.map((key) => {
    const def = DOMAIN_DEFS[key];
    // If real data provided, use it for status/updated/fill
    if (realData && realData[key]) {
      const r = realData[key];
      // contributes stays from synthetic state (hypothesis engine not wired)
      const synthetic = syntheticDomains.find((d) => d.key === key);
      return {
        key,
        icon: def.icon,
        label: def.label,
        href: def.href,
        status: r.status,
        updated: r.updated,
        fill: r.fill,
        contributes: synthetic?.contributes ?? false,
      };
    }
    // Fallback to synthetic
    const synthetic = syntheticDomains.find((d) => d.key === key);
    if (synthetic) return synthetic;
    return { key, ...def, status: "нет данных", updated: null, fill: 0, contributes: false };
  });
}

// ============================================================
// LIFECYCLE BADGE STYLES
// ============================================================
// ============================================================
// UNIFIED LIFECYCLE LANGUAGE SYSTEM
// ============================================================
// Single source of truth for all lifecycle-aware text across dashboard.
// Temperature: accent (confident) → amber (tension) → muted (paused)

interface LifecycleConfig {
  badge: string;          // short badge label
  color: string;          // badge/dot color
  subtitle: string;       // agent core subtitle
  framing: string;        // top framing strip text
  e1Label: string;        // hypothesis block label
  e2Label: string;        // supporting section label
  e3Label: string;        // weakening section label
  e4Label: string;        // missing section label
  tone: "accent" | "amber" | "muted";
}

const LIFECYCLE: Record<string, LifecycleConfig> = {
  emerging: {
    badge: "ранняя нить", color: "var(--text-muted)",
    subtitle: "Ранняя рабочая гипотеза", framing: "Появилась рабочая нить анализа",
    e1Label: "Рабочая гипотеза", e2Label: "Что уже указывает", e3Label: "Ослабляет", e4Label: "Что нужно для уточнения",
    tone: "accent",
  },
  plausible: {
    badge: "есть опора", color: "rgba(45,212,191,0.7)",
    subtitle: "Рабочая гипотеза с опорой", framing: "Гипотеза получила опору — есть согласованные сигналы",
    e1Label: "Рабочая гипотеза", e2Label: "Что поддерживает", e3Label: "Что пока не сходится", e4Label: "Что ещё нужно",
    tone: "accent",
  },
  supported: {
    badge: "устойчивая опора", color: "var(--accent)",
    subtitle: "Гипотеза с устойчивой опорой", framing: "Гипотеза получила опору — есть согласованные сигналы",
    e1Label: "Рабочая гипотеза", e2Label: "На чём держится", e3Label: "Что стоит перепроверить", e4Label: "Что ещё может усилить вывод",
    tone: "accent",
  },
  weakened: {
    badge: "есть противоречие", color: "var(--amber)",
    subtitle: "Гипотеза с противоречием", framing: "Появились данные, ослабляющие гипотезу — нужна перепроверка",
    e1Label: "Гипотеза под вопросом", e2Label: "Что всё ещё поддерживает", e3Label: "Что ослабляет", e4Label: "Что поможет разрешить противоречие",
    tone: "amber",
  },
  deprioritized: {
    badge: "отложено", color: "var(--text-muted)",
    subtitle: "Гипотеза отложена", framing: "Гипотеза отложена — есть более приоритетные направления",
    e1Label: "Гипотеза отложена", e2Label: "Что было видно", e3Label: "Что ослабляло", e4Label: "Чего не хватало",
    tone: "muted",
  },
  unresolved: {
    badge: "неясно", color: "var(--text-muted)",
    subtitle: "Недостаточно данных", framing: "Данных недостаточно для уверенного движения",
    e1Label: "Недостаточно данных", e2Label: "Что уже есть", e3Label: "Что не даёт сделать вывод", e4Label: "Чего не хватает для вывода",
    tone: "muted",
  },
  "urgent review needed": {
    badge: "срочный пересмотр", color: "var(--amber)",
    subtitle: "Срочный пересмотр гипотезы", framing: "Гипотеза требует срочного пересмотра",
    e1Label: "Гипотеза под вопросом", e2Label: "Что поддерживало", e3Label: "Что требует пересмотра", e4Label: "Что нужно срочно",
    tone: "amber",
  },
};

const LIFECYCLE_DEFAULT: LifecycleConfig = {
  badge: "без вывода", color: "var(--text-muted)",
  subtitle: "", framing: "Появилась рабочая нить анализа",
  e1Label: "Рабочая гипотеза", e2Label: "Подтверждается", e3Label: "Ослабляет", e4Label: "Чего не хватает",
  tone: "accent",
};

// Backward-compatible accessors
const LIFECYCLE_STYLES: Record<string, { label: string; color: string }> = Object.fromEntries(
  Object.entries(LIFECYCLE).map(([k, v]) => [k, { label: v.badge, color: v.color }])
);
const LIFECYCLE_FALLBACK = { label: LIFECYCLE_DEFAULT.badge, color: LIFECYCLE_DEFAULT.color };

// ============================================================
// MAIN COMPONENT
// ============================================================

export interface RealHypothesis {
  statement: string;
  status: string;
  confidence_level: string;
  supporting: { signal: string; domain: string }[];
  weakening: { signal: string; domain: string }[];
  missing: { signal: string; domain: string; target_href: string }[];
  next_step: { text: string; reason: string; domain: string; href: string };
  contributing_domains: string[];
  updated_at: string;
}

export function DataFlowDashboard({
  realDomains,
  serverMeta,
  demoState,
  realConcern,
  realHypothesis,
  concernId,
  canGenerate,
  canRegenerate,
  hypothesisIsStale,
  hypothesisStaleReasons,
  hypothesisMetaLabel,
  concernLinkage,
  hypothesisConcernEvidence,
}: {
  realDomains?: RealDomainData;
  serverMeta?: ServerMeta;
  demoState?: DemoState;
  realConcern?: { name: string; question: string; status?: string } | null;
  realHypothesis?: RealHypothesis | null;
  concernId?: string;
  canGenerate?: boolean;
  canRegenerate?: boolean;
  hypothesisIsStale?: boolean;
  hypothesisStaleReasons?: string[];
  hypothesisMetaLabel?: string | null;
  concernLinkage?: { diary: number; vitals: number; documents: number };
  hypothesisConcernEvidence?: { diary: number; vitals: number; documents: number } | null;
}) {
  // Extract user name from greeting: "Добрый день, Никита." → "Никита"
  const greetingStr = serverMeta?.greeting ?? "";
  const nameMatch = greetingStr.match(/,\s*([^.]+)\./);
  const userName = nameMatch?.[1]?.trim() || "пользователь";

  // ── Welcome overlay (one-time, user-scoped, client-side) ──
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const welcomeKey = `medhub-dashboard-welcome-seen:${userName.toLowerCase().replace(/\s+/g, "-")}`;
  useEffect(() => {
    if (!localStorage.getItem(welcomeKey)) {
      setShowWelcome(true);
    }
    setWelcomeChecked(true);
  }, [welcomeKey]);

  function dismissWelcome() {
    localStorage.setItem(welcomeKey, "1");
    setShowWelcome(false);
  }

  const activeState = demoState && DEMO_STATES.includes(demoState) ? demoState : DEFAULT_DEMO_STATE;
  const s = STATES[activeState];

  // Detect forced preview mode: demoState set + real data doesn't match synthetic expectations
  const isForcedPreview = !!demoState && demoState !== "low_data" && !realConcern && s.concern !== null;

  // Concern: use real if available, else synthetic (forced preview uses synthetic)
  const concern = isForcedPreview ? s.concern : (realConcern !== undefined ? realConcern : s.concern);
  const dataSnapshot = isForcedPreview
    ? s.coreDomains.filter(d => d.fill > 0).map(d => ({ text: `${d.label}: ${d.status}`, href: d.href }))
    : (serverMeta?.dataSnapshot ?? []);

  // Real hypothesis present = all E1–E5 from DB, no synthetic mixing
  const useRealHypothesis = !isForcedPreview && !!realHypothesis && !!realHypothesis.statement;

  // Merge real data into domain cards — forced preview uses synthetic fills
  const coreDomains = isForcedPreview
    ? s.coreDomains.map(d => ({ ...d }))
    : buildDomains(CORE_KEYS, realDomains, s.coreDomains);
  const contextDomains = isForcedPreview
    ? s.contextDomains.map(d => ({ ...d }))
    : buildDomains(CONTEXT_KEYS, realDomains, s.contextDomains);

  // If real hypothesis, override contributes from contributing_domains
  if (useRealHypothesis) {
    const contribSet = new Set(realHypothesis!.contributing_domains);
    for (const d of coreDomains) d.contributes = contribSet.has(d.key);
    for (const d of contextDomains) d.contributes = contribSet.has(d.key);
  }

  const allDomains = [...coreDomains, ...contextDomains];

  // Agent context: always from server meta or synthetic fallback
  const greeting = serverMeta?.greeting ?? s.agent.greeting;
  const observation = serverMeta?.observation ?? s.agent.observation;

  // ── SOURCE SPLIT: real hypothesis vs pre-hypothesis vs synthetic preview ──

  let hypothesis: { text: string; state: string } | null;
  let supporting: { text: string; domain: string; href?: string }[];
  let weakening: { text: string; domain: string; href?: string }[];
  let missing: MissingItem[];
  let nextAction: { text: string; reason: string; href: string; sourceDomain?: string };

  const SAFE_MISSING: MissingItem = { text: "Нужны дополнительные данные", targetHref: "/diary" };
  const SAFE_NEXT: { text: string; reason: string; href: string } = {
    text: "Добавить данные в дневник",
    reason: "Дополнительные данные помогут уточнить гипотезу",
    href: "/diary",
  };

  if (useRealHypothesis) {
    // ── REAL HYPOTHESIS MODE: all from DB, no synthetic mixing ──
    hypothesis = { text: realHypothesis!.statement, state: realHypothesis!.status };
    supporting = realHypothesis!.supporting.map((s) => ({ text: s.signal, domain: DOMAIN_DEFS[s.domain]?.label ?? s.domain, href: DOMAIN_DEFS[s.domain]?.href }));
    weakening = realHypothesis!.weakening.map((w) => ({ text: w.signal, domain: DOMAIN_DEFS[w.domain]?.label ?? w.domain, href: DOMAIN_DEFS[w.domain]?.href }));

    const realMissingItems = realHypothesis!.missing.map((m) => ({ text: m.signal, targetHref: m.target_href, sourceDomain: DOMAIN_DEFS[m.domain]?.label ?? m.domain }));
    missing = realMissingItems.length > 0 ? realMissingItems : [SAFE_MISSING];

    const ns = realHypothesis!.next_step;
    nextAction = ns?.text && ns?.href
      ? { text: ns.text, reason: ns.reason || "", href: ns.href, sourceDomain: ns.domain ? (DOMAIN_DEFS[ns.domain]?.label ?? ns.domain) : undefined }
      : SAFE_NEXT;

  } else if (s.hypothesis !== null && !realHypothesis) {
    // ── SYNTHETIC PREVIEW MODE (dev ?_state= with hypothesis) ──
    hypothesis = s.hypothesis;
    supporting = s.supporting;
    weakening = s.weakening;
    missing = s.missing;
    nextAction = s.nextAction;

  } else {
    // ── PRE-HYPOTHESIS MODE: no hypothesis, use serverMeta for missing/next ──
    hypothesis = null;
    supporting = [];
    weakening = [];
    const realMissing = serverMeta?.missingItems ?? [];
    missing = realMissing.length > 0 ? realMissing : s.missing;
    nextAction = serverMeta?.nextAction ?? s.nextAction;
  }

  const hasHypothesis = hypothesis !== null;
  const filledDomainCount = allDomains.filter(d => d.fill > 0).length;
  const hasPartialData = !!concern && !hasHypothesis && filledDomainCount > 0;
  const lifecycle = hasHypothesis ? (LIFECYCLE_STYLES[hypothesis!.state] ?? LIFECYCLE_FALLBACK) : null;

  return (
    <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6">
      {/* ── WELCOME OVERLAY (one-time) ── */}
      {welcomeChecked && showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.75)" }}>
          <div
            className="relative mx-4 w-full max-w-[480px] rounded-2xl overflow-hidden"
            style={{ backgroundColor: "var(--bg-primary)", border: "1px solid rgba(45,212,191,0.15)" }}
          >
            {/* Agent presence marker */}
            <div className="flex justify-center pt-8 pb-2">
              <div className="relative">
                <div
                  className="h-12 w-12 rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(45,212,191,0.25) 0%, rgba(45,212,191,0.05) 70%, transparent 100%)",
                    boxShadow: "0 0 30px rgba(45,212,191,0.15), 0 0 60px rgba(45,212,191,0.05)",
                  }}
                />
                <div
                  className="absolute inset-0 m-auto h-5 w-5 rounded-full"
                  style={{ backgroundColor: "var(--accent)", opacity: 0.8 }}
                />
              </div>
            </div>

            {/* Agent voice */}
            <div className="px-8 pb-8 pt-4 text-center">
              <p className="text-[18px] font-bold leading-[1.3]" style={{ color: "var(--text-primary)" }}>
                {userName}, привет.
              </p>
              <p className="mt-4 text-[13px] leading-[1.6]" style={{ color: "var(--text-muted)" }}>
                Это твоя рабочая среда наблюдения. Здесь я буду собирать данные, искать связи и строить рабочие гипотезы — чтобы ты видел полную картину, а не разрозненные записи.
              </p>
              <p className="mt-3 text-[13px] leading-[1.6]" style={{ color: "var(--text-muted)" }}>
                Вся основная работа будет происходить на этом экране. Для начала мне нужен твой базовый профиль и одна цель наблюдения — то, что тебя сейчас беспокоит.
              </p>
              <button
                onClick={dismissWelcome}
                className="mt-6 rounded-lg px-8 py-3 text-[14px] font-bold transition-all hover:brightness-110"
                style={{ backgroundColor: "var(--accent)", color: "var(--bg-primary)" }}
              >
                Понятно
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-5 pt-5 pb-5">

        {/* ── AGENT CONTEXT / START FLOW ── */}
        {!concern && !hasHypothesis ? (
          /* ──── WORKSPACE ENTRY SCENE ──── */
          <div>
            {/* Agent intro line */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="shrink-0 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)", opacity: 0.5 }} />
              <p className="text-[11px]" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                {userName}, это твоя рабочая среда. Два шага для старта:
              </p>
            </div>

            {/* Steps — integrated, not boxed */}
            <div className="space-y-2">
              {/* Step 1 */}
              <div className="flex items-center gap-3.5 rounded-lg px-4 py-3 transition-all" style={{
                backgroundColor: "rgba(45,212,191,0.03)",
                borderLeft: "3px solid var(--accent)",
              }}>
                <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold" style={{ backgroundColor: "var(--accent)", color: "var(--bg-primary)" }}>1</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>Заполнить базовый профиль</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Контекст для интерпретации: пол, возраст, диагнозы</p>
                </div>
                <Link
                  href="/profile"
                  className="shrink-0 rounded-lg px-4 py-2 text-[12px] font-bold transition-all hover:brightness-110"
                  style={{ backgroundColor: "var(--accent)", color: "var(--bg-primary)" }}
                >
                  Заполнить
                </Link>
              </div>

              {/* Step 2 */}
              <div className="rounded-lg px-4 py-3" style={{
                backgroundColor: "rgba(255,255,255,0.01)",
                borderLeft: "3px solid rgba(45,212,191,0.15)",
              }}>
                <div className="flex items-start gap-3.5">
                  <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold mt-0.5" style={{ border: "1.5px solid rgba(45,212,191,0.3)", color: "var(--accent)" }}>2</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>Указать, что беспокоит</p>
                    <p className="text-[10px] mt-0.5 mb-2" style={{ color: "var(--text-muted)" }}>Фокус для анализа: симптом, вопрос или направление</p>
                    <ConcernCreateForm />
                  </div>
                </div>
              </div>
            </div>

            {/* Transition cue to workspace */}
            <div className="mt-2 flex items-center gap-2 px-1">
              <div className="h-px flex-1" style={{ backgroundColor: "rgba(45,212,191,0.06)" }} />
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] shrink-0" style={{ color: "var(--text-muted)", opacity: 0.25 }}>
                рабочее пространство
              </p>
              <div className="h-px flex-1" style={{ backgroundColor: "rgba(45,212,191,0.06)" }} />
            </div>
          </div>
        ) : (
          /* ──── NORMAL STATE (partial / concern / hypothesis) ──── */
          <>
            <div>
              <p className="text-[16px] font-bold leading-[1.35]" style={{ color: "var(--text-primary)" }}>
                {greeting}
              </p>
              <p className="mt-1 text-[12px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>
                {observation}
              </p>
            </div>

            {/* Partial state progress strip */}
            {hasPartialData && (
              <div className="mt-2 flex items-center gap-3 rounded-lg px-4 py-2.5" style={{ backgroundColor: "rgba(45,212,191,0.03)", border: "1px solid rgba(45,212,191,0.08)" }}>
                <div className="shrink-0 h-2 w-2 rounded-full" style={{ backgroundColor: "var(--accent)", opacity: 0.6 }} />
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Принято {filledDomainCount} из {allDomains.length} источников — {filledDomainCount >= 3 ? "уже могу начать строить картину" : "нужно ещё немного данных"}
                </p>
              </div>
            )}

            {/* Hypothesis state framing strip — lifecycle-aware */}
            {hasHypothesis && lifecycle && (() => {
              const lc = LIFECYCLE[activeState] ?? LIFECYCLE_DEFAULT;
              const toneColors = {
                accent: { bg: "rgba(45,212,191,0.04)", border: "rgba(45,212,191,0.12)", dot: "var(--accent)", badgeBg: "rgba(45,212,191,0.08)", text: "var(--text-primary)", dotOp: 0.8 },
                amber: { bg: "rgba(245,158,11,0.04)", border: "rgba(245,158,11,0.12)", dot: "var(--amber)", badgeBg: "rgba(245,158,11,0.08)", text: "var(--text-primary)", dotOp: 0.8 },
                muted: { bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)", dot: "var(--text-muted)", badgeBg: "rgba(255,255,255,0.06)", text: "var(--text-muted)", dotOp: 0.5 },
              };
              const t = toneColors[lc.tone];
              // Matured states get slightly stronger accent
              const isMatured = activeState === "supported" || activeState === "plausible";
              return (
                <div className="mt-2 flex items-center gap-3 rounded-lg px-4 py-2.5" style={{
                  backgroundColor: isMatured ? "rgba(45,212,191,0.05)" : t.bg,
                  border: `1px solid ${isMatured ? "rgba(45,212,191,0.15)" : t.border}`,
                }}>
                  <div className="shrink-0 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.dot, opacity: isMatured ? 1 : t.dotOp }} />
                  <p className="text-[11px] font-medium" style={{ color: t.text }}>{lc.framing}</p>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded shrink-0" style={{ backgroundColor: t.badgeBg, color: lc.color }}>
                    {lc.badge}
                  </span>
                </div>
              );
            })()}

            {concern && <ConcernBlock concern={concern} lifecycle={lifecycle} concernStatus={realConcern?.status} linkage={concernLinkage} />}
          </>
        )}

        {/* ── DATA FLOW COMPOSITION ── */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,5fr)_36px_minmax(0,7fr)] sm:gap-0">

          {/* ═══ LEFT — DATA SOURCES / INPUT LAYER ═══ */}
          <div className="order-2 sm:order-1">
            {/* MCO cue — empty state only */}
            {!concern && !hasHypothesis && (
              <p className="mb-2 px-1 text-[9px] italic leading-[1.4]" style={{ color: "var(--text-muted)", opacity: 0.4 }}>
                Входные данные для агента →
              </p>
            )}

            {/* Input layer container */}
            <div className="rounded-lg sm:pr-1" style={{ borderRight: !concern && !hasHypothesis ? "2px solid rgba(45,212,191,0.06)" : "none" }}>
              {/* Core domains header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <p className="text-[8px] font-bold uppercase tracking-[0.16em] shrink-0" style={{ color: "var(--accent)", opacity: 0.5 }}>
                  Опорные данные
                </p>
                <div className="h-px flex-1" style={{ backgroundColor: "rgba(45,212,191,0.12)" }} />
              </div>

              {/* Core domains — primary medical input */}
              <div className="space-y-[5px]">
                {coreDomains.map((d) => (
                  <DomainCard key={d.key} domain={d} isCore isNextBest={d.href === nextAction.href && !hasHypothesis} />
                ))}
              </div>

              {/* Context domains header */}
              <div className="flex items-center gap-2 mt-4 mb-1.5 px-1">
                <p className="text-[7px] font-bold uppercase tracking-[0.14em] shrink-0" style={{ color: "var(--text-muted)", opacity: 0.35 }}>
                  Контекст
                </p>
                <div className="h-px flex-1" style={{ backgroundColor: "rgba(255,255,255,0.05)" }} />
              </div>

              {/* Context domains — secondary/supporting input */}
              <div className="space-y-[3px]">
                {contextDomains.map((d) => (
                  <DomainCard key={d.key} domain={d} isCore={false} />
                ))}
              </div>
            </div>
          </div>

          {/* ═══ MIDDLE — FLOW BRIDGE (hidden on mobile) ═══ */}
          <div className="hidden sm:block sm:order-2 relative">
            <FlowBridgeSVG domains={allDomains} coreCount={coreDomains.length} />
          </div>

          {/* ═══ RIGHT — AGENT CORE ═══ */}
          <div
            className="order-1 sm:order-3 rounded-xl overflow-hidden flex flex-col"
            style={{
              border: `1px solid ${hasHypothesis ? "rgba(45,212,191,0.12)" : hasPartialData ? "rgba(45,212,191,0.12)" : "rgba(45,212,191,0.1)"}`,
              backgroundColor: hasHypothesis ? "rgba(45,212,191,0.015)" : hasPartialData ? "rgba(45,212,191,0.02)" : "rgba(45,212,191,0.015)",
              boxShadow: hasPartialData ? "0 0 24px rgba(45,212,191,0.04)" : !hasHypothesis ? "0 0 20px rgba(45,212,191,0.03)" : "none",
            }}
          >
            {/* Top accent line */}
            <div className="h-[2.5px]" style={{
              backgroundColor: hasHypothesis ? "rgba(45,212,191,0.25)" : hasPartialData ? "rgba(45,212,191,0.2)" : "rgba(45,212,191,0.15)",
            }} />

            {/* Agent identity + panel header */}
            <div className="px-4 pt-3.5 pb-2.5" style={{ borderLeft: `3px solid rgba(45,212,191,${hasHypothesis ? "0.35" : "0.2"})` }}>
              <div className="flex items-center gap-3">
                {/* Agent core marker */}
                <div className="relative shrink-0">
                  <div className="h-8 w-8 rounded-full" style={{
                    background: hasHypothesis
                      ? "radial-gradient(circle, rgba(45,212,191,0.35) 0%, rgba(45,212,191,0.08) 60%, transparent 100%)"
                      : hasPartialData
                        ? "radial-gradient(circle, rgba(45,212,191,0.25) 0%, rgba(45,212,191,0.06) 60%, transparent 100%)"
                        : "radial-gradient(circle, rgba(45,212,191,0.2) 0%, rgba(45,212,191,0.04) 60%, transparent 100%)",
                    boxShadow: hasHypothesis ? "0 0 12px rgba(45,212,191,0.1)" : hasPartialData ? "0 0 10px rgba(45,212,191,0.07)" : "0 0 8px rgba(45,212,191,0.05)",
                  }} />
                  <div className="absolute inset-0 m-auto h-3 w-3 rounded-full" style={{
                    backgroundColor: "var(--accent)",
                    opacity: hasHypothesis ? 0.8 : hasPartialData ? 0.6 : 0.5,
                  }} />
                </div>
                <div>
                  <p className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {hasHypothesis ? "Синтез агента" : "Агент наблюдения"}
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                    {hasHypothesis ? "" : hasPartialData ? `работаю с ${filledDomainCount} из ${allDomains.length} источников` : !concern ? "жду опорные сигналы" : "собираю картину"}
                  </p>
                </div>
              </div>
              {/* Persistent greeting — context-aware */}
              {!concern && !hasHypothesis && (
                <p className="mt-2 text-[11px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>
                  {userName}, я готов начать. Как только появятся опорные данные слева — начну собирать картину.
                </p>
              )}
              {hasPartialData && (
                <p className="mt-2 text-[11px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>
                  {userName}, я уже вижу часть картины. Для уверенного старта нужно ещё {allDomains.length - filledDomainCount > 3 ? "несколько источников" : `${allDomains.length - filledDomainCount} источник${allDomains.length - filledDomainCount === 1 ? "" : "а"}`}.
                </p>
              )}
              {hasHypothesis && (LIFECYCLE[activeState] ?? LIFECYCLE_DEFAULT).subtitle && (
                <p className="mt-0.5 ml-[20px] text-[9px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>
                  {(LIFECYCLE[activeState] ?? LIFECYCLE_DEFAULT).subtitle}
                </p>
              )}
            </div>

            {hasHypothesis ? (
              /* ──────── HYPOTHESIS MODE ──────── */
              <>
                {/* Meta strip: last update time */}
                {hypothesisMetaLabel && (
                  <p className="px-4 pb-1 text-[9px]" style={{ color: "var(--text-muted)", opacity: 0.3 }}>
                    {hypothesisMetaLabel}{hypothesisConcernEvidence ? ` · фокус: ${hypothesisConcernEvidence.diary > 0 ? `${hypothesisConcernEvidence.diary} дн.` : ""}${hypothesisConcernEvidence.diary > 0 && (hypothesisConcernEvidence.vitals > 0 || hypothesisConcernEvidence.documents > 0) ? " · " : ""}${hypothesisConcernEvidence.vitals > 0 ? `${hypothesisConcernEvidence.vitals} пок.` : ""}${hypothesisConcernEvidence.vitals > 0 && hypothesisConcernEvidence.documents > 0 ? " · " : ""}${hypothesisConcernEvidence.documents > 0 ? `${hypothesisConcernEvidence.documents} док.` : ""}` : ""}
                  </p>
                )}

                {/* E1: Hypothesis Statement — leading finding */}
                {(() => {
                  const lc = LIFECYCLE[activeState] ?? LIFECYCLE_DEFAULT;
                  const colorBase = lc.tone === "amber" ? "rgba(245,158,11," : lc.tone === "muted" ? "rgba(255,255,255," : "rgba(45,212,191,";
                  const labelColor = lc.tone === "amber" ? "var(--amber)" : lc.tone === "muted" ? "var(--text-muted)" : "var(--accent)";
                  const isPaused = lc.tone === "muted";
                  return (
                <div className="mx-4 mb-3 rounded-lg px-3.5 py-3" style={{
                  backgroundColor: `${colorBase}0.03)`,
                  border: `1px solid ${colorBase}${isPaused ? "0.06" : "0.08"})`,
                  borderLeftWidth: "3px",
                  borderLeftColor: `${colorBase}${isPaused ? "0.15" : "0.35"})`,
                  opacity: isPaused ? 0.8 : 1,
                }}>
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] mb-1.5" style={{ color: labelColor, opacity: 0.5 }}>
                    {lc.e1Label}
                  </p>
                  <p className="text-[12px] leading-[1.55] font-medium" style={{ color: "var(--text-primary)" }}>
                    {hypothesis!.text}
                  </p>
                  {realHypothesis?.confidence_level && (
                    <p className="mt-1.5 text-[9px]" style={{ color: "var(--text-muted)", opacity: 0.45 }}>
                      {({ low: "низкая опора", medium: "умеренная опора", high: "сильная опора" } as Record<string, string>)[realHypothesis.confidence_level] ?? ""}
                    </p>
                  )}
                </div>
                  );
                })()}

                {/* E2: Supporting Evidence */}
                {supporting.length > 0 && (
                  <SynthesisSection
                    label={(LIFECYCLE[activeState] ?? LIFECYCLE_DEFAULT).e2Label}
                    labelColor="var(--accent)"
                    emphasis={activeState === "supported" || activeState === "plausible" ? "strong" : "normal"}
                  >
                    {supporting.map((ev, i) => {
                      const inner = (
                        <>
                          <div className="mt-[5px] shrink-0 h-[5px] w-[5px] rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                          <div>
                            <p className="text-[11px] leading-[1.45]" style={{ color: "var(--text-primary)" }}>{ev.text}</p>
                            <p className="text-[8px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.4 }}>{ev.domain}</p>
                          </div>
                        </>
                      );
                      return ev.href ? (
                        <Link key={i} href={ev.href} className="flex items-start gap-2 transition-opacity hover:opacity-75">
                          {inner}
                        </Link>
                      ) : (
                        <div key={i} className="flex items-start gap-2">{inner}</div>
                      );
                    })}
                  </SynthesisSection>
                )}

                {/* E3: Weakening / Limiting Evidence — equal weight in matured states */}
                {weakening.length > 0 && (() => {
                  const isMatured = activeState === "supported" || activeState === "plausible";
                  return (
                    <div className="px-4 py-2.5" style={{
                      borderTop: "1px solid rgba(255,255,255,0.04)",
                      backgroundColor: isMatured ? "rgba(245,158,11,0.02)" : "transparent",
                    }}>
                      <p
                        className="text-[8px] font-bold uppercase tracking-[0.12em] mb-2"
                        style={{ color: "var(--amber)", opacity: isMatured ? 0.6 : activeState === "weakened" ? 0.55 : 0.35 }}
                      >
                        {(LIFECYCLE[activeState] ?? LIFECYCLE_DEFAULT).e3Label}
                      </p>
                      <div className="space-y-2">
                        {weakening.map((ev, i) => {
                          const inner = (
                            <>
                              <div className="mt-[5px] shrink-0 h-[6px] w-[6px] rounded-full" style={{ backgroundColor: "var(--amber)", opacity: isMatured ? 0.8 : 0.7 }} />
                              <div>
                                <p className="text-[11px] leading-[1.45]" style={{ color: "var(--text-primary)" }}>{ev.text}</p>
                                <p className="text-[8px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.4 }}>{ev.domain}</p>
                              </div>
                            </>
                          );
                          return ev.href ? (
                            <Link key={i} href={ev.href} className="flex items-start gap-2 transition-opacity hover:opacity-75">
                              {inner}
                            </Link>
                          ) : (
                            <div key={i} className="flex items-start gap-2">{inner}</div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* E4: Missing Evidence — dominant in emerging/unresolved */}
                {(() => {
                  const missingDominant = activeState === "emerging" || activeState === "unresolved";
                  const label = (LIFECYCLE[activeState] ?? LIFECYCLE_DEFAULT).e4Label;
                  return (
                    <SynthesisSection
                      label={label}
                      labelColor="var(--text-muted)"
                      emphasis={missingDominant ? "strong" : "normal"}
                    >
                      {missing.map((m, i) => (
                        <Link key={i} href={m.targetHref} className="flex items-start gap-2 group transition-all hover:brightness-125">
                          <div className="mt-[5px] shrink-0 h-[5px] w-[5px] rounded-full" style={{
                            border: `1.5px solid ${missingDominant ? "rgba(245,158,11,0.35)" : "rgba(255,255,255,0.12)"}`,
                          }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] leading-[1.45]" style={{
                              color: missingDominant ? "var(--text-primary)" : "rgba(255,255,255,0.4)",
                            }}>{m.text}</p>
                            {m.sourceDomain && (
                              <p className="text-[8px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.25 }}>→ {m.sourceDomain}</p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </SynthesisSection>
                  );
                })()}
              </>
            ) : (
              /* ──────── PRE-HYPOTHESIS MODE ──────── */
              <>
                {concern ? (
                  <>
                    {/* Partial state: accepted input surface */}
                    {hasPartialData && dataSnapshot.length > 0 && (
                      <div className="mx-4 mb-3 rounded-lg px-3.5 py-3" style={{ backgroundColor: "rgba(45,212,191,0.03)", border: "1px solid rgba(45,212,191,0.08)" }}>
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1.5" style={{ color: "var(--accent)", opacity: 0.6 }}>
                          Что я уже принял
                        </p>
                        <div className="space-y-1">
                          {dataSnapshot.map((snap, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <div className="mt-[5px] shrink-0 h-[5px] w-[5px] rounded-full" style={{ backgroundColor: "var(--accent)", opacity: 0.4 }} />
                              <p className="text-[11px] leading-[1.4]" style={{ color: "var(--text-primary)" }}>
                                {snap.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing — primary action driver */}
                    <SynthesisSection
                      label={hasPartialData ? `Что ещё нужно для «${concern.name}»` : `Что нужно для «${concern.name}»`}
                      labelColor="var(--text-muted)"
                      emphasis="strong"
                    >
                      {missing.map((m, i) => (
                        <Link key={i} href={m.targetHref} className="flex items-start gap-2 transition-all hover:brightness-125">
                          <div className="mt-[5px] shrink-0 h-[5px] w-[5px] rounded-full" style={{ border: "1.5px solid rgba(245,158,11,0.3)" }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] leading-[1.45]" style={{ color: "var(--text-primary)" }}>{m.text}</p>
                            {m.sourceDomain && (
                              <p className="text-[8px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.35 }}>→ {m.sourceDomain}</p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </SynthesisSection>

                    {/* Snapshot — only shown if NOT partial (partial shows it above as "Что я уже принял") */}
                    {!hasPartialData && dataSnapshot.length > 0 && (
                      <SynthesisSection label="Уже есть" labelColor="var(--text-muted)" emphasis="normal">
                        {dataSnapshot.map((snap, i) => (
                          <Link key={i} href={snap.href} className="flex items-start gap-2 transition-all hover:brightness-125">
                            <div className="mt-[5px] shrink-0 h-[5px] w-[5px] rounded-full" style={{ backgroundColor: "var(--accent)", opacity: 0.35 }} />
                            <p className="text-[11px] leading-[1.4]" style={{ color: "var(--text-muted)" }}>{snap.text}</p>
                          </Link>
                        ))}
                      </SynthesisSection>
                    )}

                    {/* Generate hypothesis trigger — only when conditions met */}
                    {canGenerate && concernId && (
                      <GenerateHypothesisButton concernId={concernId} />
                    )}
                  </>
                ) : (
                  <>
                  {/* Agent framing line */}
                  <div className="mx-4 mb-3 px-3 py-2" style={{ borderLeft: "2px solid rgba(45,212,191,0.15)" }}>
                    <p className="text-[11px] leading-[1.5] italic" style={{ color: "var(--text-muted)" }}>
                      Я пока жду входные данные. Чем полнее опорные сигналы слева — тем точнее будет стартовый анализ.
                    </p>
                  </div>

                  {/* Unified reasoning surface */}
                  <div className="mx-4 mb-2 space-y-0">
                    {/* What I see */}
                    <div className="px-3.5 py-2.5 rounded-t-lg" style={{ backgroundColor: "rgba(45,212,191,0.03)", border: "1px solid rgba(45,212,191,0.06)", borderBottom: "none" }}>
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: "var(--accent)", opacity: 0.5 }}>
                        Что я вижу
                      </p>
                      {dataSnapshot.length > 0 ? (
                        <div className="space-y-0.5">
                          {dataSnapshot.map((snap, i) => (
                            <Link key={i} href={snap.href} className="block text-[11px] leading-[1.4] transition-opacity hover:opacity-75" style={{ color: "var(--text-primary)" }}>
                              {snap.text}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>
                          Пока ничего — данные ещё не поступали.
                        </p>
                      )}
                    </div>

                    {/* What blocks me */}
                    <div className="px-3.5 py-2.5" style={{ backgroundColor: "rgba(245,158,11,0.02)", borderLeft: "1px solid rgba(45,212,191,0.06)", borderRight: "1px solid rgba(45,212,191,0.06)" }}>
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: "var(--amber)", opacity: 0.5 }}>
                        Что мне мешает
                      </p>
                      <p className="text-[11px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>
                        Нет цели наблюдения и базового контекста — не могу начать анализ.
                      </p>
                    </div>

                    {/* What to collect */}
                    <div className="px-3.5 py-2.5 rounded-b-lg space-y-1.5" style={{ border: "1px solid rgba(45,212,191,0.06)", borderTop: "none" }}>
                      <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--amber)", opacity: 0.5 }}>
                        Что мне нужно от тебя
                      </p>
                      {missing.map((m, i) => (
                        <Link key={i} href={m.targetHref} className="flex items-start gap-2 transition-all hover:brightness-125">
                          <div className="mt-[5px] shrink-0 h-[5px] w-[5px] rounded-full" style={{ border: "1.5px solid rgba(245,158,11,0.3)" }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] leading-[1.45]" style={{ color: "var(--text-primary)" }}>{m.text}</p>
                            {m.sourceDomain && (
                              <p className="text-[8px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.35 }}>→ {m.sourceDomain}</p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                  </>
                )}
              </>
            )}

            {/* Stale hypothesis indicator — real hypothesis mode only */}
            {hasHypothesis && hypothesisIsStale && (
              <div className="mx-4 mt-1 mb-1 px-3 py-2 rounded-md" style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.12)" }}>
                <p className="text-[10px] font-bold" style={{ color: "var(--amber)" }}>Появились новые данные</p>
                {(hypothesisStaleReasons && hypothesisStaleReasons.length > 0 ? hypothesisStaleReasons : ["Гипотеза может требовать пересборки"]).map((r, i) => (
                  <p key={i} className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.6 }}>→ {r}</p>
                ))}
              </div>
            )}

            {/* Regenerate / clear hypothesis — real hypothesis mode only */}
            {hasHypothesis && concernId && (
              <div className="px-4 py-2 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                {canRegenerate && <RegenerateHypothesisButton concernId={concernId} />}
                <ClearHypothesisButton concernId={concernId} />
              </div>
            )}

            {/* E5: Next Best Action — primary in data states, informational in empty */}
            <Link
              href={nextAction.href}
              className="mt-auto flex items-center gap-3 px-4 py-3 transition-all hover:brightness-110"
              style={{
                backgroundColor: (concern || hasHypothesis) ? "rgba(45,212,191,0.04)" : "rgba(255,255,255,0.02)",
                borderTop: `1px solid ${(concern || hasHypothesis) ? "rgba(45,212,191,0.08)" : "rgba(255,255,255,0.04)"}`,
              }}
            >
              <span className="shrink-0 flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold" style={{
                backgroundColor: (concern || hasHypothesis) ? "rgba(45,212,191,0.12)" : "rgba(255,255,255,0.06)",
                color: (concern || hasHypothesis) ? "var(--accent)" : "var(--text-muted)",
              }}>→</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold" style={{ color: (concern || hasHypothesis) ? "var(--text-primary)" : "var(--text-muted)" }}>{nextAction.text}</p>
                <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>{nextAction.reason}</p>
                {nextAction.sourceDomain && (
                  <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.4 }}>→ {nextAction.sourceDomain}</p>
                )}
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

const DOMAIN_MCO: Record<string, string> = {
  symptoms:    "Симптомы — основной сигнал. Без них я не вижу, что именно происходит.",
  vitals:      "Объективные измерения усиливают картину. Давление, пульс, температура — факты, а не ощущения.",
  medications: "Терапия влияет на всё остальное. Мне важно знать, что ты принимаешь.",
  documents:   "Анализы и заключения — самый сильный объективный слой для подтверждения или опровержения.",
  timeline:    "Хронология помогает мне видеть последовательность событий и находить причинно-следственные связи.",
  baseline:    "Базовый профиль — контекст для интерпретации. Без него я анализирую фрагменты, а не человека.",
  wellbeing:   "Общее самочувствие помогает мне отслеживать динамику между конкретными сигналами.",
  lifestyle:   "Образ жизни — скрытый контекст. Сон, нагрузка, питание часто объясняют то, что не видно в анализах.",
  emotions:    "Эмоциональный фон может быть связан с физическими сигналами. Мне важно видеть эту связь.",
  triggers:    "Триггеры помогают мне понять, что запускает ухудшение или улучшение.",
};

function DomainCard({ domain: d, isCore, isNextBest }: { domain: Domain; isCore: boolean; isNextBest?: boolean }) {
  const [showTip, setShowTip] = useState(false);
  const hasData = d.fill > 0;
  const isEmpty = d.fill === 0;
  const isSparse = d.fill > 0 && d.fill < 0.3;
  const isReady = d.fill >= 0.6;
  const mcoText = DOMAIN_MCO[d.key];

  // Status semantics
  const statusLabel = isEmpty ? "не начато" : isReady ? (d.contributes ? d.status : "достаточно") : d.status || "частично";
  const statusDotColor = isEmpty
    ? "rgba(245,158,11,0.35)"
    : isReady
      ? "var(--accent)"
      : "rgba(45,212,191,0.4)";

  // Visual weight tiers
  const barColor = isReady ? "var(--accent)" : hasData ? "rgba(45,212,191,0.4)" : "rgba(255,255,255,0.04)";
  const edgeColor = d.contributes
    ? "var(--accent)"
    : d.fill >= 0.6
      ? "rgba(45,212,191,0.5)"
      : d.fill > 0
        ? "rgba(45,212,191,0.18)"
        : "rgba(255,255,255,0.04)";

  // Core vs context: different sizing, spacing, and visual presence
  if (isCore) {
    return (
      <div className="relative">
        <Link
          href={d.href}
          className="group relative block rounded-lg transition-all hover:brightness-110 hover:translate-x-[1px]"
          style={{
            padding: "9px 10px 9px 14px",
            backgroundColor: isNextBest
              ? "rgba(45,212,191,0.035)"
              : isEmpty
                ? "rgba(255,255,255,0.015)"
                : d.contributes
                  ? "rgba(45,212,191,0.04)"
                  : "rgba(45,212,191,0.02)",
            border: `1px solid ${isNextBest ? "rgba(45,212,191,0.18)" : isEmpty ? "rgba(255,255,255,0.06)" : d.contributes ? "rgba(45,212,191,0.16)" : "rgba(45,212,191,0.08)"}`,
            opacity: isEmpty && !isNextBest ? 0.8 : 1,
          }}
        >
          {/* Left edge — contribution/weight/next-best indicator */}
          <div className="absolute left-0 top-[6px] bottom-[6px] w-[2.5px] rounded-full" style={{
            backgroundColor: isNextBest ? "var(--accent)" : edgeColor,
          }} />

          <div className="flex items-center gap-2 pl-1">
            <span className="shrink-0 text-[14px]" style={{ color: hasData ? "var(--accent)" : isNextBest ? "rgba(45,212,191,0.5)" : "rgba(255,255,255,0.25)" }}>
              {d.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="shrink-0 h-[6px] w-[6px] rounded-full" style={{ backgroundColor: statusDotColor }} />
                  <span className="text-[11px] font-bold truncate" style={{ color: hasData ? "var(--text-primary)" : isNextBest ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)" }}>
                    {d.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[9px] font-medium" style={{
                    color: isEmpty ? "rgba(245,158,11,0.4)" : isSparse ? "rgba(45,212,191,0.5)" : "rgba(45,212,191,0.8)",
                  }}>
                    {statusLabel}
                  </span>
                  {mcoText && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTip(!showTip); }}
                      className="text-[9px] leading-none transition-opacity hover:opacity-100"
                      style={{ color: "var(--accent)", opacity: showTip ? 0.7 : 0.25 }}
                    >?</button>
                  )}
                </div>
              </div>
              {/* Updated timestamp — only for core with data */}
              {d.updated && (
                <p className="text-[8px] mt-0.5" style={{ color: "var(--text-muted)", opacity: 0.35 }}>
                  обновлено {d.updated}
                </p>
              )}
              {/* Fill bar — thicker for core */}
              <div className="mt-[4px] h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(d.fill * 100, isEmpty ? 0 : 4)}%`, backgroundColor: barColor }} />
              </div>
            </div>
          </div>
        </Link>
        {/* MCO tooltip */}
        {showTip && mcoText && (
          <div
            className="absolute z-20 left-4 right-0 mt-1 rounded-lg px-3 py-2"
            style={{ backgroundColor: "var(--bg-surface)", border: "1px solid rgba(45,212,191,0.12)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
          >
            <p className="text-[10px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>{mcoText}</p>
          </div>
        )}
      </div>
    );
  }

  // Context domain — compact, secondary
  return (
    <div className="relative">
      <Link
        href={d.href}
        className="group relative block rounded-md transition-all hover:brightness-110 hover:translate-x-[1px]"
        style={{
          padding: "5px 8px 5px 10px",
          backgroundColor: isEmpty ? "transparent" : "rgba(255,255,255,0.015)",
          border: `1px solid ${isEmpty ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)"}`,
          opacity: isEmpty ? 0.6 : 0.75,
        }}
      >
        {/* Thin edge — subtle */}
        {hasData && (
          <div className="absolute left-0 top-[4px] bottom-[4px] w-[1.5px] rounded-full" style={{ backgroundColor: edgeColor }} />
        )}

        <div className="flex items-center gap-1.5 pl-0.5">
          <div className="shrink-0 h-[5px] w-[5px] rounded-full" style={{ backgroundColor: statusDotColor, opacity: 0.7 }} />
          <span className="shrink-0 text-[10px]" style={{ color: hasData ? "rgba(45,212,191,0.5)" : "rgba(255,255,255,0.12)" }}>
            {d.icon}
          </span>
          <span className="text-[9px] font-medium truncate" style={{ color: hasData ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.25)" }}>
            {d.label}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <span className="text-[8px]" style={{ color: hasData ? "rgba(255,255,255,0.3)" : "rgba(245,158,11,0.3)" }}>
              {statusLabel}
            </span>
            {mcoText && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTip(!showTip); }}
                className="text-[8px] leading-none transition-opacity hover:opacity-100"
                style={{ color: "var(--accent)", opacity: showTip ? 0.6 : 0.2 }}
              >?</button>
            )}
          </div>
        </div>
      </Link>
      {showTip && mcoText && (
        <div
          className="absolute z-20 left-2 right-0 mt-1 rounded-lg px-3 py-2"
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid rgba(45,212,191,0.12)", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
        >
          <p className="text-[10px] leading-[1.5]" style={{ color: "var(--text-muted)" }}>{mcoText}</p>
        </div>
      )}
    </div>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  not_enough_data: "Недостаточно данных для гипотезы",
  already_exists: "Гипотеза уже создана",
  ai_quota: "Лимит AI исчерпан",
  generation_failed: "Не удалось сформировать гипотезу",
  no_concern: "Сначала создайте цель наблюдения",
};

function GenerateHypothesisButton({ concernId }: { concernId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);
    const result = await generateHypothesisForConcern(concernId);
    if (!result.ok) {
      setError(ERROR_MESSAGES[result.reason] ?? "Произошла ошибка");
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="px-4 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <button
        onClick={handleGenerate}
        disabled={pending}
        className="rounded-md px-4 py-2 text-[11px] font-bold transition-all hover:brightness-110 disabled:opacity-50"
        style={{ backgroundColor: "rgba(45,212,191,0.1)", color: "var(--accent)" }}
      >
        {pending ? "Формирую..." : "Сформировать рабочую гипотезу"}
      </button>
      {error && (
        <p className="mt-1.5 text-[10px]" style={{ color: "var(--amber)" }}>{error}</p>
      )}
    </div>
  );
}

const REGENERATE_ERROR_MESSAGES: Record<string, string> = {
  no_concern: "Сначала создайте цель наблюдения",
  not_enough_data: "Недостаточно данных для гипотезы",
  already_exists: "Гипотеза уже существует",
  ai_quota: "Лимит AI исчерпан",
  generation_failed: "Не удалось пересобрать гипотезу",
};

function RegenerateHypothesisButton({ concernId }: { concernId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate() {
    setPending(true);
    setError(null);
    const result = await regenerateHypothesisForConcern(concernId);
    if (!result.ok) {
      setError(REGENERATE_ERROR_MESSAGES[result.reason] ?? "Произошла ошибка");
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={handleRegenerate}
        disabled={pending}
        className="rounded-md px-3 py-1.5 text-[10px] font-medium transition-all hover:brightness-110 disabled:opacity-50"
        style={{ backgroundColor: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}
      >
        {pending ? "Пересобираю..." : "Пересобрать гипотезу"}
      </button>
      {error && (
        <p className="mt-1.5 text-[10px]" style={{ color: "var(--amber)" }}>{error}</p>
      )}
    </div>
  );
}

function ClearHypothesisButton({ concernId }: { concernId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClear() {
    setPending(true);
    await clearHypothesisForConcern(concernId);
    router.refresh();
  }

  return (
    <button
      onClick={handleClear}
      disabled={pending}
      className="text-[9px] transition-colors hover:brightness-125 disabled:opacity-30"
      style={{ color: "var(--text-muted)", opacity: 0.4 }}
    >
      {pending ? "..." : "сбросить гипотезу"}
    </button>
  );
}

function ClearConcernButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClear() {
    setPending(true);
    await clearConcern();
    router.refresh();
  }

  return (
    <button
      onClick={handleClear}
      disabled={pending}
      className="text-[9px] transition-colors hover:brightness-125 disabled:opacity-30"
      style={{ color: "var(--text-muted)", opacity: 0.4 }}
    >
      {pending ? "..." : "сбросить"}
    </button>
  );
}

const CONCERN_STATUS_LABELS: Record<string, string> = {
  active: "активна",
  paused: "пауза",
  resolved: "завершена",
};

function ConcernBlock({ concern, lifecycle, concernStatus, linkage }: {
  concern: { name: string; question: string };
  lifecycle: { label: string; color: string } | null;
  concernStatus?: string;
  linkage?: { diary: number; vitals: number; documents: number };
}) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  if (editing) {
    return <ConcernCreateForm initial={concern} onCancel={() => setEditing(false)} />;
  }

  const status = concernStatus ?? "active";
  const totalLinked = (linkage?.diary ?? 0) + (linkage?.vitals ?? 0) + (linkage?.documents ?? 0);

  async function cycleStatus() {
    const next = status === "active" ? "paused" : status === "paused" ? "resolved" : "active";
    await updateConcernStatus(next);
    router.refresh();
  }

  return (
    <div
      className="mt-3 rounded-lg px-3.5 py-2.5"
      style={{
        backgroundColor: "rgba(45,212,191,0.025)",
        border: "1px solid rgba(45,212,191,0.1)",
        borderLeft: "2.5px solid rgba(45,212,191,0.35)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>
            {concern.name}
          </p>
          {concern.question && (
            <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
              {concern.question}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lifecycle && (
            <span
              className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ backgroundColor: "rgba(45,212,191,0.08)", color: lifecycle.color }}
            >
              {lifecycle.label}
            </span>
          )}
          <button
            onClick={cycleStatus}
            className="text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors hover:brightness-125"
            style={{
              backgroundColor: status === "active" ? "rgba(45,212,191,0.08)" : "rgba(255,255,255,0.04)",
              color: status === "active" ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {CONCERN_STATUS_LABELS[status] ?? status}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="text-[9px] transition-colors hover:brightness-125"
            style={{ color: "var(--text-muted)", opacity: 0.4 }}
          >
            изменить
          </button>
          <ClearConcernButton />
        </div>
      </div>
      {totalLinked > 0 && (
        <p className="mt-1 text-[9px]" style={{ color: "var(--text-muted)", opacity: 0.35 }}>
          Привязано: {linkage!.diary > 0 ? `${linkage!.diary} дн.` : ""}{linkage!.diary > 0 && (linkage!.vitals > 0 || linkage!.documents > 0) ? " · " : ""}{linkage!.vitals > 0 ? `${linkage!.vitals} пок.` : ""}{linkage!.vitals > 0 && linkage!.documents > 0 ? " · " : ""}{linkage!.documents > 0 ? `${linkage!.documents} док.` : ""}
        </p>
      )}
    </div>
  );
}

function ConcernCreateForm({
  initial,
  onCancel,
}: {
  initial?: { name: string; question: string };
  onCancel?: () => void;
} = {}) {
  const isEdit = !!initial;
  const [open, setOpen] = useState(isEdit);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-lg px-3.5 py-3 transition-all hover:brightness-110"
        style={{
          backgroundColor: "rgba(255,255,255,0.015)",
          border: "1px dashed rgba(255,255,255,0.08)",
          borderLeft: "2.5px dashed rgba(255,255,255,0.12)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.2)" }}>◎</span>
          <div>
            <p className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>
              Что вас сейчас беспокоит?
            </p>
            <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
              Укажите симптом или вопрос — агент начнёт собирать картину
            </p>
          </div>
        </div>
      </button>
    );
  }

  function handleCancel() {
    if (onCancel) onCancel();
    else setOpen(false);
  }

  return (
    <form
      action={createConcern}
      className="rounded-lg px-3.5 py-3"
      style={{
        backgroundColor: "rgba(45,212,191,0.02)",
        border: "1px solid rgba(45,212,191,0.1)",
        borderLeft: "2.5px solid rgba(45,212,191,0.35)",
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2.5" style={{ color: "var(--accent)", opacity: 0.4 }}>
        {isEdit ? "Изменить цель наблюдения" : "Новая цель наблюдения"}
      </p>
      <input
        name="title"
        required
        defaultValue={initial?.name ?? ""}
        placeholder="Например: повторяющиеся головные боли"
        className="w-full rounded-md px-3 py-2 text-[12px] outline-none transition-colors"
        style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "var(--text-primary)",
        }}
        autoFocus
      />
      <input
        name="key_question"
        defaultValue={initial?.question ?? ""}
        placeholder="Что хотите выяснить? (необязательно)"
        className="w-full rounded-md px-3 py-2 text-[12px] outline-none transition-colors mt-2"
        style={{
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "var(--text-primary)",
        }}
      />
      <div className="flex items-center gap-2 mt-3">
        <button
          type="submit"
          className="rounded-md px-4 py-2 text-[11px] font-bold transition-all hover:brightness-110"
          style={{ backgroundColor: "rgba(45,212,191,0.15)", color: "var(--accent)" }}
        >
          {isEdit ? "Сохранить" : "Начать наблюдение"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="text-[10px] px-3 py-2 rounded-md transition-colors hover:brightness-125"
          style={{ color: "var(--text-muted)" }}
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

function SynthesisSection({
  label, labelColor, emphasis, children,
}: {
  label: string;
  labelColor: string;
  emphasis: "strong" | "normal";
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <p
        className="text-[8px] font-bold uppercase tracking-[0.12em] mb-2"
        style={{ color: labelColor, opacity: emphasis === "strong" ? 0.55 : 0.35 }}
      >
        {label}
      </p>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}

function FlowBridgeSVG({ domains, coreCount }: { domains: Domain[]; coreCount: number }) {
  // Card heights match actual rendered sizes
  const coreCardH = 52;   // 9+9 padding + label + timestamp + fill bar + gaps
  const coreGap = 5;
  const contextCardH = 30; // 5+5 padding + single line
  const contextGap = 3;

  // Vertical offsets
  const coreHeaderH = 24;  // "Опорные данные" header
  const contextHeaderH = 32; // gap + "Контекст" header

  // Compute Y center for each domain card
  function getY(i: number): number {
    if (i < coreCount) {
      return coreHeaderH + i * (coreCardH + coreGap) + coreCardH / 2;
    }
    const coreBlockH = coreHeaderH + coreCount * (coreCardH + coreGap);
    const ci = i - coreCount;
    return coreBlockH + contextHeaderH + ci * (contextCardH + contextGap) + contextCardH / 2;
  }

  const totalH = getY(domains.length - 1) + 30;

  // Right panel target: distribute contributing lines toward upper portion,
  // non-contributing toward lower — creates visual clustering
  const contributingIdxs = domains.map((d, i) => d.contributes ? i : -1).filter(i => i >= 0);
  const nonContribIdxs = domains.map((d, i) => !d.contributes && d.fill > 0 ? i : -1).filter(i => i >= 0);
  const emptyIdxs = domains.map((d, i) => d.fill === 0 ? i : -1).filter(i => i >= 0);

  function getRightY(i: number): number {
    // Contributing lines converge toward hypothesis area (upper right panel)
    const d = domains[i];
    if (d.contributes) {
      const ci = contributingIdxs.indexOf(i);
      const span = Math.max(contributingIdxs.length - 1, 1);
      return 40 + (ci / span) * (totalH * 0.3);
    }
    // Data lines go to middle area
    if (d.fill > 0) {
      const ni = nonContribIdxs.indexOf(i);
      const span = Math.max(nonContribIdxs.length - 1, 1);
      return totalH * 0.4 + (ni / span) * (totalH * 0.3);
    }
    // Empty lines drift toward bottom
    const ei = emptyIdxs.indexOf(i);
    const span = Math.max(emptyIdxs.length - 1, 1);
    return totalH * 0.7 + (ei / span) * (totalH * 0.2);
  }

  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox={`0 0 36 ${totalH}`}>
      {/* Central flow rail — group-level directional cue */}
      <defs>
        <linearGradient id="flowRail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(45,212,191,0.08)" />
          <stop offset="50%" stopColor="rgba(45,212,191,0.04)" />
          <stop offset="100%" stopColor="rgba(45,212,191,0.01)" />
        </linearGradient>
      </defs>
      <rect x="16" y="0" width="4" height={totalH} rx="2" fill="url(#flowRail)" />

      {/* Per-domain flow lines */}
      {[...emptyIdxs, ...nonContribIdxs, ...contributingIdxs].map((i) => {
        const d = domains[i];
        const yFrom = getY(i);
        const yTo = getRightY(i);

        let opacity: number;
        let strokeW: number;
        let dash: string;

        if (d.contributes) {
          opacity = 0.45;
          strokeW = 1.8;
          dash = "none";
        } else if (d.fill > 0) {
          opacity = 0.12;
          strokeW = 0.7;
          dash = "none";
        } else {
          opacity = 0.07;
          strokeW = 0.5;
          dash = "3,5";
        }

        const cpXLeft = d.contributes ? 22 : 18;
        const cpXRight = d.contributes ? 14 : 18;

        return (
          <path
            key={d.key}
            d={`M 0 ${yFrom} C ${cpXLeft} ${yFrom}, ${cpXRight} ${yTo}, 36 ${yTo}`}
            fill="none"
            stroke="rgba(45,212,191,1)"
            strokeWidth={strokeW}
            strokeOpacity={opacity}
            strokeDasharray={dash}
          />
        );
      })}
    </svg>
  );
}
