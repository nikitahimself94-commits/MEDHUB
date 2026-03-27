import { getSessionPatient } from "@/lib/get-patient-id";
import { getAiUsageCount, AI_MONTHLY_LIMIT } from "@/lib/check-ai-quota";
import { AiUsageStatus } from "@/components/ai-usage-status";
import type { SupabaseClient } from "@supabase/supabase-js";

const AI_FEATURES = [
  {
    name: "AI-чат",
    href: "/ai-chat",
    description: "Задайте вопрос о здоровье — ассистент видит ваш профиль, дневник, показатели и лекарства.",
  },
  {
    name: "AI-разбор документа",
    href: "/documents",
    description: "Автоматическое извлечение ключевых данных из загруженного медицинского документа.",
  },
  {
    name: "Второе мнение",
    href: "/documents",
    description: "Расширенный анализ документа: что важно, какие вопросы задать врачу, чего не хватает.",
  },
  {
    name: "Подготовка к визиту",
    href: "/doctor-visit",
    description: "Структурированная сводка вашего состояния с вопросами для обсуждения с врачом.",
  },
];

export default async function AiPlanPage() {
  const { patientId, supabase } = await getSessionPatient();
  const used = await getAiUsageCount(supabase as unknown as SupabaseClient, patientId);
  const remaining = Math.max(0, AI_MONTHLY_LIMIT - used);

  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>AI-возможности</h2>

      <div className="mt-4">
        <AiUsageStatus used={used} />
      </div>

      <div className="mt-6 rounded-xl card p-5">
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Ваш текущий лимит</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded p-3 text-center" style={{ backgroundColor: "var(--bg-surface-hover)" }}>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{AI_MONTHLY_LIMIT}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>доступно за 30 дней</p>
          </div>
          <div className="rounded p-3 text-center" style={{ backgroundColor: "var(--bg-surface-hover)" }}>
            <p className="text-2xl font-bold text-accent">{used}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>использовано</p>
          </div>
          <div className="rounded p-3 text-center" style={{ backgroundColor: "var(--bg-surface-hover)" }}>
            <p className="text-2xl font-bold" style={{ color: remaining === 0 ? "var(--amber)" : "var(--accent)" }}>
              {remaining}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>осталось</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl card p-5">
        <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Что расходует AI-запросы</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Каждое использование любой из этих функций считается как один AI-запрос.
        </p>
        <div className="mt-4 space-y-3">
          {AI_FEATURES.map((f) => (
            <div key={f.name} className="flex items-start gap-3 rounded p-3" style={{ backgroundColor: "var(--bg-surface-hover)" }}>
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{f.name}</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded p-4" style={{ border: "1px solid var(--border)", backgroundColor: "var(--bg-surface-hover)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Лимит считается автоматически за скользящие 30 дней и защищает сервис от перегрузки.
          Неиспользованные запросы не переносятся. Счётчик обновляется после каждого AI-вызова.
        </p>
      </div>
    </div>
  );
}
