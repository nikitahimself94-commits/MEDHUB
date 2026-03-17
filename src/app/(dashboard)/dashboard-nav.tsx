"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Главная" },
  { href: "/profile", label: "Карта" },
  { href: "/medications", label: "Лекарства" },
  { href: "/diary", label: "Дневник" },
  { href: "/vitals", label: "Показатели" },
  { href: "/emotions", label: "Эмоции" },
  { href: "/symptoms-map", label: "Симптомы" },
  { href: "/timeline", label: "Хронология" },
  { href: "/documents", label: "Документы" },
  { href: "/doctor-visit", label: "Врач" },
  { href: "/ai-chat", label: "AI-чат" },
  { href: "/ai-plan", label: "AI-план" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      className="overflow-x-auto lg:overflow-x-visible"
      style={{
        backgroundColor: "#CDD5D2",
        borderBottom: "1px solid #BFC8C5",
        padding: "8px 0",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        className="mx-auto flex max-w-5xl items-center lg:justify-center"
        style={{ gap: "4px", padding: "0 12px", minWidth: "max-content" }}
      >
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="shrink-0 whitespace-nowrap"
              style={{
                padding: "7px 12px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "0.01em",
                transition: "all 0.15s",
                textDecoration: "none",
                ...(isActive
                  ? {
                      backgroundColor: "#2D6E6A",
                      color: "#FFFFFF",
                      boxShadow: "0 1px 3px rgba(45,110,106,0.2)",
                    }
                  : {
                      backgroundColor: "transparent",
                      color: "#4A7A72",
                    }),
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
