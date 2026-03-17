"use client";

import { useState } from "react";
import { deleteDiaryEntry } from "./actions";

export function DeleteDiaryButton({ id }: { id: string }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Вы уверены, что хотите удалить запись?")) return;

    setDeleting(true);
    try {
      await deleteDiaryEntry(id);
    } catch {
      alert("Не удалось удалить запись");
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
    >
      {deleting ? "Удаление..." : "Удалить"}
    </button>
  );
}
