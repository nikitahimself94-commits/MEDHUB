import Link from "next/link";

// ---------------------------------------------------------------------------
// AgentHint — reusable micro-presence primitive for dashboard shell.
// Renders a compact hint line with label + text, optionally as a link.
// ---------------------------------------------------------------------------

interface AgentHintProps {
  label: string;
  text: string;
  href?: string;
  variant?: "muted" | "accent" | "unlock";
}

const VARIANT_STYLES = {
  muted: { color: "var(--text-muted)", opacity: 0.65 },
  accent: { color: "var(--accent)", opacity: 0.75 },
  unlock: { color: "var(--accent)", opacity: 0.85 },
} as const;

export function AgentHint({ label, text, href, variant = "muted" }: AgentHintProps) {
  const style = VARIANT_STYLES[variant];
  const isUnlock = variant === "unlock";

  const content = (
    <p
      className={`text-[${isUnlock ? "12" : "11"}px] leading-snug`}
      style={{ color: style.color, opacity: style.opacity }}
    >
      <span className="font-medium">{label}</span> {text}
    </p>
  );

  if (href) {
    return (
      <Link href={href} className="block transition hover:brightness-125">
        {content}
      </Link>
    );
  }

  return content;
}
