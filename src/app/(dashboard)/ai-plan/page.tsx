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
      <h2 className="text-2xl font-bold text-gray-900">AI-возможности</h2>

      <div className="mt-4">
        <AiUsageStatus used={used} />
      </div>

      <div className="mt-6 rounded-xl card p-5">
        <h3 className="text-base font-semibold text-gray-900">Ваш текущий лимит</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="rounded bg-gray-50 p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{AI_MONTHLY_LIMIT}</p>
            <p className="mt-1 text-xs text-gray-500">доступно за 30 дней</p>
          </div>
          <div className="rounded bg-gray-50 p-3 text-center">
            <p className="text-2xl font-bold text-brand-600">{used}</p>
            <p className="mt-1 text-xs text-gray-500">использовано</p>
          </div>
          <div className="rounded bg-gray-50 p-3 text-center">
            <p className={`text-2xl font-bold ${remaining === 0 ? "text-red-600" : "text-teal-600"}`}>
              {remaining}
            </p>
            <p className="mt-1 text-xs text-gray-500">осталось</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl card p-5">
        <h3 className="text-base font-semibold text-gray-900">Что расходует AI-запросы</h3>
        <p className="mt-1 text-sm text-gray-500">
          Каждое использование любой из этих функций считается как один AI-запрос.
        </p>
        <div className="mt-4 space-y-3">
          {AI_FEATURES.map((f) => (
            <div key={f.name} className="flex items-start gap-3 rounded bg-gray-50 p-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">{f.name}</p>
                <p className="text-sm text-gray-600">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          Лимит считается автоматически за скользящие 30 дней и защищает сервис от перегрузки.
          Неиспользованные запросы не переносятся. Счётчик обновляется после каждого AI-вызова.
        </p>
      </div>
    </div>
  );
}
