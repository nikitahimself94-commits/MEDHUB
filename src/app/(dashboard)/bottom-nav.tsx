"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Карта",
    routes: ["/dashboard"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="9" strokeDasharray="4 3" />
      </svg>
    ),
  },
  {
    href: "/diary",
    label: "Пульс",
    routes: ["/diary", "/emotions"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 7.65l.78.77L12 20.64l7.64-7.64.78-.77a5.4 5.4 0 0 0 0-7.65z" />
      </svg>
    ),
  },
  {
    href: "/records",
    label: "Данные",
    routes: ["/records", "/vitals", "/medications", "/symptoms-map", "/timeline", "/profile"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 16l4-8 4 4 4-6" />
      </svg>
    ),
  },
  {
    href: "/documents",
    label: "Библиотека",
    routes: ["/documents"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <path d="M14 2v6h6" />
      </svg>
    ),
  },
  {
    href: "/doctor-visit",
    label: "Ещё",
    routes: ["/doctor-visit", "/ai-chat", "/ai-plan"],
    matchPrefix: ["/share"],
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="12" cy="19" r="1.5" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();

  function isActive(item: typeof NAV_ITEMS[number]) {
    if (item.routes.includes(pathname)) return true;
    if (item.matchPrefix) {
      for (const prefix of item.matchPrefix) {
        if (pathname.startsWith(prefix)) return true;
      }
    }
    return false;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors"
              style={{
                color: active ? "var(--accent)" : "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                style={{
                  backgroundColor: active ? "var(--accent-muted)" : "transparent",
                }}
              >
                {item.icon}
              </span>
              <span
                className="text-[10px] font-semibold leading-tight"
                style={{ letterSpacing: "0.01em" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
