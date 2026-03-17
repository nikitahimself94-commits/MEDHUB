import { cookies } from "next/headers";

/**
 * Returns the start of the current local day (midnight) as a UTC Date,
 * based on the user's timezone from the `tz` cookie.
 *
 * Supports all IANA timezones including fractional offsets
 * (e.g. Asia/Kolkata +5:30, Asia/Kathmandu +5:45, Pacific/Chatham +12:45/+13:45).
 *
 * Falls back to UTC if the cookie is missing or invalid.
 */
export function getLocalDayStart(): Date {
  const tz = cookies().get("tz")?.value;

  if (!tz) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  try {
    // 1. Get the current local date in the user's timezone
    //    "sv-SE" locale produces YYYY-MM-DD format
    const now = new Date();
    const localDate = now.toLocaleDateString("sv-SE", { timeZone: tz });
    const [y, m, d] = localDate.split("-").map(Number);

    // 2. Compute the exact UTC offset (in minutes) for this date+timezone.
    //    Use a probe at UTC noon of that date.
    const probeUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

    //    Format the probe in the target timezone to get local date+time
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(probeUtc);

    const localH = Number(parts.find((p) => p.type === "hour")?.value ?? 12);
    const localM = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    const localDay = Number(parts.find((p) => p.type === "day")?.value ?? d);

    // Local total minutes from midnight
    let localTotalMin = localH * 60 + localM;

    // If the probe landed in a different day, adjust for the day wrap.
    // probe is UTC noon (12:00) of date `d`.
    // If localDay > d (or wrapped month), the tz is ahead and crossed midnight.
    // If localDay < d, the tz is behind and went to previous day.
    if (localDay !== d) {
      if (localDay > d || (localDay === 1 && d > 27)) {
        // Crossed forward: e.g. UTC 12:00 Mar 17 → local 01:45 Mar 18
        // Actual local minutes from probe's UTC noon = 24h + localTotalMin
        localTotalMin += 24 * 60;
      } else {
        // Crossed backward: e.g. UTC 12:00 Mar 17 → local 23:00 Mar 16
        localTotalMin -= 24 * 60;
      }
    }

    // offset = local minutes − UTC minutes (720 = 12:00 in minutes)
    const offsetMinutes = localTotalMin - 12 * 60;

    // 3. Midnight local = 00:00 of localDate in UTC
    //    = Date.UTC(y, m-1, d, 0, 0) − offset
    const midnightUtcMs = Date.UTC(y, m - 1, d) - offsetMinutes * 60_000;

    return new Date(midnightUtcMs);
  } catch {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}
