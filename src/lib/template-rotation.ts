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

export type RotationState = Record<string, number[]>;

/**
 * Server-side rotation context. Created per request from persisted state.
 * After all picks, call getState() and write it back to profiles.
 */
export class ServerRotation {
  private state: RotationState;
  private dirty = false;

  constructor(persisted: RotationState | null | undefined) {
    this.state = persisted ? { ...persisted } : {};
  }

  pick<T>(contextKey: string, pool: readonly T[]): T {
    if (pool.length <= 1) return pool[0];

    const recent = this.state[contextKey] ?? [];
    const picked = pickExcluding(pool.length, recent);

    this.state[contextKey] = [...recent, picked].slice(-MAX_HISTORY);
    this.dirty = true;

    return pool[picked];
  }

  /** Returns state to persist. Only non-empty keys included. */
  getState(): RotationState {
    return this.state;
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
