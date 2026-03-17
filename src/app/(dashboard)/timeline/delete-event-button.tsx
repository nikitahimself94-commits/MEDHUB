"use client";

import { useTransition } from "react";
import { deleteTimelineEvent } from "./actions";

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm("Удалить событие?")) return;
    startTransition(async () => {
      try {
        await deleteTimelineEvent(eventId);
      } catch {
        alert("Не удалось удалить событие");
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
