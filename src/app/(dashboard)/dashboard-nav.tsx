"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Сводка" },
  { href: "/records", label: "Записи" },
  { href: "/documents", label: "Документы" },
  { href: "/doctor-visit", label: "Врач" },
];

export function DashboardNav() {
  const pathname = usePathname();

  // Match sub-routes to parent nav items
  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard" ||
        pathname === "/ai-chat" ||
        pathname === "/ai-plan";
    }
    if (href === "/records") {
      return pathname === "/records" ||
        pathname === "/diary" ||
        pathname === "/medications" ||
        pathname === "/vitals" ||
        pathname === "/emotions" ||
        pathname === "/symptoms-map" ||
        pathname === "/timeline" ||
        pathname === "/profile";
    }
    if (href === "/documents") return pathname === "/documents";
    if (href === "/doctor-visit") {
      return pathname === "/doctor-visit" ||
        pathname.startsWith("/share");
    }
    return pathname === href;
  }

  return (
    <nav
      style={{
        backgroundColor: "#CDD5D2",
        borderBottom: "1px solid #BFC8C5",
        padding: "8px 0",
      }}
    >
      <div
        className="mx-auto flex max-w-5xl items-center justify-center"
        style={{ gap: "6px", padding: "0 16px" }}
      >
        {NAV_ITEMS.map(({ href, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 text-center"
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: 700,
                letterSpacing: "0.01em",
                transition: "all 0.15s",
                textDecoration: "none",
                ...(active
                  ? {
                      backgroundColor: "#2D6E6A",
                      color: "#FFFFFF",
                      boxShadow: "0 2px 6px rgba(45,110,106,0.25)",
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
