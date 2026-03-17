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
      className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "Отмена..." : "Отменить последнее"}
    </button>
  );
}
