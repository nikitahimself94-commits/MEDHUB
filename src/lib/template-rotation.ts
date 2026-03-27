// ---------------------------------------------------------------------------
// Template rotation v1 — phrase variation with anti-repeat memory.
//
// Two scopes:
//   1. Client-side reactions (diary/vitals/emotions) → in-memory Map.
//      Persists within page session. Resets on navigation. Acceptable.
//
//   2. Server-side hero → ServerRotation class with explicit state in/out.
//      State is read from / written to profiles.companion_rotation_state.
//      Per-user, persistent across visits.
//
// Algorithm: exclude last N used indices (up to poolSize - 1),
// pick randomly from remaining candidates.
// ---------------------------------------------------------------------------

const MAX_HISTORY = 3;
const MAX_RECENT_TEMPLATES = 10;
const RECENT_KEY = "_recent_templates";

// ===== Client-side: in-memory per-session =====

const clientHistory = new Map<string, number[]>();

/**
 * Client-side rotation. Memory lives in module-level Map (page session).
 * Used by diary/vitals/emotions post-save reactions.
 */
export function rotated<T>(contextKey: string, pool: readonly T[]): T {
  if (pool.length <= 1) return pool[0];

  const recent = clientHistory.get(contextKey) ?? [];
  const picked = pickExcluding(pool.length, recent);

  const updated = [...recent, picked].slice(-MAX_HISTORY);
  clientHistory.set(contextKey, updated);

  return pool[picked];
}

// ===== Server-side: persistent per-user =====

/**
 * Persisted JSONB blob shape for rotation state.
 * Context bucket keys hold number[] (index history).
 * Reserved `_recent_templates` holds string[] (template identifiers).
 * The index signature uses `number[] | string[]` to honestly represent both.
 */
export interface RotationState {
  [key: string]: number[] | string[];
}

/**
 * Server-side rotation context. Created per request from persisted state.
 * After all picks, call getState() and write it back to profiles.
 */
export class ServerRotation {
  private buckets: Record<string, number[]>;
  private recentTemplates: string[];
  private dirty = false;

  constructor(persisted: RotationState | null | undefined) {
    if (persisted) {
      const { [RECENT_KEY]: recent, ...rest } = persisted;
      // Index buckets: all keys except the reserved _recent_templates
      const buckets: Record<string, number[]> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (Array.isArray(v) && v.every((x) => typeof x === "number")) {
          buckets[k] = v as number[];
        }
      }
      this.buckets = buckets;
      this.recentTemplates = Array.isArray(recent) ? (recent as string[]) : [];
    } else {
      this.buckets = {};
      this.recentTemplates = [];
    }
  }

  pick<T>(contextKey: string, pool: readonly T[]): T {
    if (pool.length <= 1) return pool[0];

    const recent = this.buckets[contextKey] ?? [];
    const picked = pickExcluding(pool.length, recent);

    this.buckets[contextKey] = [...recent, picked].slice(-MAX_HISTORY);
    this.recentTemplates = [
      ...this.recentTemplates,
      `${contextKey}#${picked}`,
    ].slice(-MAX_RECENT_TEMPLATES);
    this.dirty = true;

    return pool[picked];
  }

  /** Returns full blob to persist (index buckets + _recent_templates). */
  getState(): RotationState {
    return {
      ...this.buckets,
      [RECENT_KEY]: this.recentTemplates,
    };
  }

  /** Recent template identifiers from current + prior picks. */
  getRecentTemplates(): string[] {
    return this.recentTemplates;
  }

  /** Extract _recent_templates from a raw persisted rotation blob. */
  static extractRecentTemplates(
    raw: Record<string, unknown> | null | undefined,
  ): string[] {
    if (!raw || typeof raw !== "object") return [];
    const arr = raw[RECENT_KEY];
    return Array.isArray(arr) ? arr : [];
  }

  /** True if any pick was made since construction. */
  isDirty(): boolean {
    return this.dirty;
  }
}

// ===== Shared pick algorithm =====

function pickExcluding(poolSize: number, recent: number[]): number {
  const excludeCount = Math.min(recent.length, poolSize - 1);
  const excluded = new Set(recent.slice(-excludeCount));

  const candidates: number[] = [];
  for (let i = 0; i < poolSize; i++) {
    if (!excluded.has(i)) candidates.push(i);
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}
