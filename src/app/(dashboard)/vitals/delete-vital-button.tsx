"use client";

import { useTransition } from "react";
import { deleteVital } from "./actions";

export function DeleteVitalButton({ vitalId }: { vitalId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Удалить запись?")) return;
    startTransition(async () => {
      try {
        await deleteVital(vitalId);
      } catch {
        alert("Не удалось удалить запись");
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
