"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { resetReviewState } from "./review-reset-action";

const ARRIVAL_KEY = "medhub:arrival_v2";

/**
 * DEV-ONLY: detects ?reset-review in URL, resets onboarding + arrival state,
 * clears localStorage suppression, redirects to clean /dashboard.
 */
export function ReviewReset() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "resetting" | "done">("idle");

  useEffect(() => {
    if (params.get("reset-review") === null) return;
    if (status !== "idle") return;

    setStatus("resetting");

    (async () => {
      // 1. Server: clear DB state
      const result = await resetReviewState();
      if (!result.ok) {
        console.error("[ReviewReset]", result.error);
        setStatus("done");
        return;
      }

      // 2. Client: clear localStorage arrival suppression
      try {
        localStorage.removeItem(ARRIVAL_KEY);
      } catch { /* ignore */ }

      // 3. Redirect to clean URL
      setStatus("done");
      router.replace("/dashboard");
    })();
  }, [params, router, status]);

  if (status === "resetting") {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ backgroundColor: "var(--bg-primary)" }}>
        <p className="text-white text-lg font-semibold animate-pulse">
          Сброс review state…
        </p>
      </div>
    );
  }

  return null;
}
