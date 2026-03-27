"use client";

import { useTransition } from "react";
import { deleteMedication } from "./actions";

export function DeleteMedicationButton({ medicationId }: { medicationId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Удалить препарат?")) return;
    startTransition(async () => {
      try {
        await deleteMedication(medicationId);
      } catch {
        alert("Не удалось удалить препарат");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-xs disabled:opacity-50"
      style={{ color: "var(--amber)" }}
    >
      {isPending ? "Удаление..." : "Удалить"}
    </button>
  );
}
