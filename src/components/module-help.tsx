interface ModuleHelpProps {
  title: string;
  description: string;
  benefit: string;
}

export function ModuleHelp({ title, description, benefit }: ModuleHelpProps) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ backgroundColor: "var(--accent-muted)", border: "1px solid var(--border)" }}
    >
      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{description}</p>
      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{benefit}</p>
    </div>
  );
}
