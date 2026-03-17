interface ModuleHelpProps {
  title: string;
  description: string;
  benefit: string;
}

export function ModuleHelp({ title, description, benefit }: ModuleHelpProps) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{ backgroundColor: "rgba(45,110,106,0.06)", border: "1px solid rgba(45,110,106,0.10)" }}
    >
      <p className="text-sm font-semibold" style={{ color: "#1A2F2B" }}>{title}</p>
      <p className="mt-1 text-sm" style={{ color: "#3A5C54" }}>{description}</p>
      <p className="mt-1 text-sm" style={{ color: "#3D6B62" }}>{benefit}</p>
    </div>
  );
}
