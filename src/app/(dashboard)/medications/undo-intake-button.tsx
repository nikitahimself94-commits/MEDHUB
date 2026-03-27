"use client";

import { useTransition } from "react";
import { undoLastIntake } from "./actions";

export function UndoIntakeButton({
  medicationId,
  hasIntakes,
}: {
  medicationId: string;
  hasIntakes: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (!hasIntakes) return null;

  function handleClick() {
    startTransition(async () => {
      try {
        await undoLastIntake(medicationId);
      } catch {
        alert("Не удалось отменить последнюю отметку");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded px-3 py-1 text-sm disabled:opacity-50"
      style={{ border: "1px solid var(--border)", color: "var(--amber)" }}
    >
      {isPending ? "Отмена..." : "Отменить последнее"}
    </button>
  );
}
