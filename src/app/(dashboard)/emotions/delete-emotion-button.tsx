"use client";

import { useTransition } from "react";
import { deleteEmotionEntry } from "./actions";

export function DeleteEmotionButton({ entryId }: { entryId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Удалить запись?")) return;
    startTransition(async () => {
      try {
        await deleteEmotionEntry(entryId);
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
