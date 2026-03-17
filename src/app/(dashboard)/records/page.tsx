import Link from "next/link";

interface RecordItem {
  href: string;
  label: string;
  desc: string;
}

interface RecordGroup {
  title: string;
  hint: string;
  items: RecordItem[];
}

const GROUPS: RecordGroup[] = [
  {
    title: "Ежедневное наблюдение",
    hint: "Основа для AI-анализа — чем регулярнее записи, тем точнее выводы",
    items: [
      { href: "/diary", label: "Дневник", desc: "Записать самочувствие, симптомы и сон" },
      { href: "/vitals", label: "Показатели", desc: "Давление, пульс, температура и другие измерения" },
      { href: "/emotions", label: "Эмоции", desc: "Отслеживать тревогу, усталость, спокойствие" },
      { href: "/medications", label: "Лекарства", desc: "Препараты, дозировки и отметки о приёме" },
    ],
  },
  {
    title: "Картина изменений",
    hint: "Помогает AI видеть паттерны и тренды за период",
    items: [
      { href: "/symptoms-map", label: "Карта симптомов", desc: "Частота и закономерности за 14–30 дней" },
      { href: "/timeline", label: "Хронология", desc: "Визиты к врачу, анализы, процедуры" },
    ],
  },
  {
    title: "Базовый контекст",
    hint: "Фундамент, на который AI опирается при каждом анализе",
    items: [
      { href: "/profile", label: "Медицинская карточка", desc: "Группа крови, аллергии, хронические заболевания" },
    ],
  },
];

export default function RecordsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold" style={{ color: "#1A2F2B" }}>
        Записи
      </h2>
      <p className="mt-1 text-sm leading-snug" style={{ color: "#5A8F85" }}>
        Всё, что вы фиксируете, становится контекстом для AI-помощника
      </p>

      <div className="mt-6 space-y-6">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-2">
              <h3 className="text-sm font-bold" style={{ color: "#1A2F2B" }}>
                {group.title}
              </h3>
              <p className="mt-0.5 text-xs" style={{ color: "#8AA8A2" }}>
                {group.hint}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl card px-4 py-3 transition hover:shadow-md active:scale-[0.98]"
                >
                  <p className="text-[15px] font-semibold" style={{ color: "#1A2F2B" }}>
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-sm leading-snug" style={{ color: "#5A8F85" }}>
                    {item.desc}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
