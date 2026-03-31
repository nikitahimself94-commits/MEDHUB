/**
 * Companion context block — shows hypothesis-driven guidance at the top of data-entry modules.
 * Read-only, server-rendered. No actions, no interactivity.
 */

interface CompanionContextProps {
  concernTitle: string;
  reason: string;
  missingSignal?: string | null;
}

export function CompanionContext({ concernTitle, reason, missingSignal }: CompanionContextProps) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        backgroundColor: "rgba(45,212,191,0.04)",
        border: "1px solid rgba(45,212,191,0.1)",
      }}
    >
      <p className="text-[11px] font-bold" style={{ color: "var(--accent)", opacity: 0.7 }}>
        Фокус: {concernTitle}
      </p>
      <p className="mt-1 text-[11px] leading-[1.45]" style={{ color: "var(--text-muted)" }}>
        {reason}
      </p>
      {missingSignal && (
        <p className="mt-1 text-[11px] leading-[1.45]" style={{ color: "var(--text-primary)", opacity: 0.6 }}>
          → {missingSignal}
        </p>
      )}
    </div>
  );
}
