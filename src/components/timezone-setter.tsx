"use client";

import { useEffect } from "react";

/**
 * Sets a cookie with the user's IANA timezone on mount.
 * Read server-side via cookies() to compute local day boundaries.
 */
export function TimezoneSetter() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (document.cookie.includes("tz=" + tz)) return;
    document.cookie = `tz=${tz};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
  }, []);

  return null;
}
