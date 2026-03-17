import Link from "next/link";

const SECTIONS = [
  {
    href: "/diary",
    label: "Дневник",
    desc: "Самочувствие, симптомы, сон",
  },
  {
    href: "/medications",
    label: "Лекарства",
    desc: "Препараты и приёмы",
  },
  {
    href: "/vitals",
    label: "Показатели",
    desc: "Давление, пульс, температура",
  },
  {
    href: "/emotions",
    label: "Эмоции",
    desc: "Тревога, спокойствие, усталость",
  },
  {
    href: "/symptoms-map",
    label: "Карта симптомов",
    desc: "Частота и паттерны за 14/30 дней",
  },
  {
    href: "/timeline",
    label: "Хронология",
    desc: "Визиты, анализы, процедуры",
  },
  {
    href: "/profile",
    label: "Медицинская карточка",
    desc: "Группа крови, аллергии, хронические заболевания",
  },
  {
    href: "/ai-chat",
    label: "AI-помощник",
    desc: "Задать вопрос о здоровье",
  },
  {
    href: "/ai-plan",
    label: "AI-лимиты",
    desc: "Использование и доступные запросы",
  },
];

export default function RecordsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "#1A2F2B" }}>
        Ваши данные
      </h2>
      <p className="mt-1 text-sm" style={{ color: "#5A8F85" }}>
        Всё, что вы записываете и храните в MedHUB. AI использует эти данные для анализа и рекомендаций.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-xl card p-5 transition hover:shadow-md"
          >
            <p className="text-[15px] font-semibold" style={{ color: "#1A2F2B" }}>
              {s.label}
            </p>
            <p className="mt-1 text-sm" style={{ color: "#5A8F85" }}>
              {s.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
