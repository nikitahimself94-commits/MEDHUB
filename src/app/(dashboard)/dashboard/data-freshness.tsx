import Link from "next/link";

interface Layer {
  label: string;
  href: string;
  lastDate: string | null; // ISO date or null if no data
}

type FreshnessLevel = "fresh" | "recent" | "stale" | "old" | "empty";

function getFreshness(lastDate: string | null): FreshnessLevel {
  if (!lastDate) return "empty";
  const days = (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24);
  if (days < 1) return "fresh";
  if (days <= 3) return "recent";
  if (days <= 7) return "stale";
  return "old";
}

const FRESHNESS_CONFIG: Record<FreshnessLevel, { label: string; color: string; bg: string; dot: string }> = {
  fresh:  { label: "обновлено сегодня",       color: "#2D6E6A", bg: "rgba(45,110,106,0.08)", dot: "#2D6E6A" },
  recent: { label: "обновлено недавно",        color: "#3D7A6F", bg: "rgba(45,110,106,0.05)", dot: "#5A9E8F" },
  stale:  { label: "давно не обновлялось",     color: "#8A7A5A", bg: "rgba(160,140,90,0.06)", dot: "#BFA94A" },
  old:    { label: "давно не обновлялось",     color: "#8A7A5A", bg: "rgba(160,140,90,0.06)", dot: "#C4A84A" },
  empty:  { label: "данных пока нет",          color: "#9AADA6", bg: "rgba(45,110,106,0.03)", dot: "#C5CECA" },
};

function formatAgo(lastDate: string | null): string {
  if (!lastDate) return "";
  const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  if (days <= 4) return `${days} дня назад`;
  if (days <= 20) return `${days} дней назад`;
  return new Date(lastDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export function DataFreshness({ layers }: { layers: Layer[] }) {
  const allEmpty = layers.every((l) => !l.lastDate);

  return (
    <div className="rounded-2xl card p-5">
      <h3 className="text-sm font-bold" style={{ color: "#1A2F2B" }}>
        {allEmpty ? "Полнота картины" : "Актуальность данных"}
      </h3>
      <p className="mt-1 text-xs" style={{ color: "#8AA8A2" }}>
        {allEmpty
          ? "Добавьте первые записи — и картина начнёт складываться"
          : "Где картина живая, а где ещё не хватает опоры"}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {layers.map((layer) => {
          const level = getFreshness(layer.lastDate);
          const cfg = FRESHNESS_CONFIG[level];
          const ago = formatAgo(layer.lastDate);

          return (
            <Link
              key={layer.href}
              href={layer.href}
              className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 transition hover:shadow-sm"
              style={{ backgroundColor: cfg.bg }}
            >
              <span
                className="mt-1 shrink-0 h-2 w-2 rounded-full"
                style={{ backgroundColor: cfg.dot }}
              />
              <div className="min-w-0">
                <p className="text-[13px] font-medium" style={{ color: "#1A2F2B" }}>
                  {layer.label}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: cfg.color }}>
                  {level === "empty" ? cfg.label : ago}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
