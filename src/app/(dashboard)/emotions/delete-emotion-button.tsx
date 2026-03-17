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
      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
    >
      {isPending ? "Удаление..." : "Удалить"}
    </button>
  );
}
