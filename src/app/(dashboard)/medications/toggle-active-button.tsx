"use client";

import { useTransition } from "react";
import { toggleMedicationActive } from "./actions";

export function ToggleActiveButton({
  medicationId,
  active,
}: {
  medicationId: string;
  active: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await toggleMedicationActive(medicationId);
      } catch {
        alert("Не удалось изменить статус");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="text-sm disabled:opacity-50"
      style={{ color: active ? "var(--amber)" : "var(--accent)" }}
    >
      {isPending
        ? "Сохранение..."
        : active
          ? "Завершить курс"
          : "Возобновить"}
    </button>
  );
}
