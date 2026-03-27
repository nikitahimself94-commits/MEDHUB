"use client";

import { useState } from "react";
import { deleteDocument } from "./actions";

export function DeleteDocumentButton({ id }: { id: string }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Удалить документ? Это действие нельзя отменить.")) return;

    setDeleting(true);
    try {
      await deleteDocument(id);
    } catch {
      alert("Не удалось удалить документ");
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-sm disabled:opacity-50"
      style={{ color: "var(--amber)" }}
    >
      {deleting ? "Удаление..." : "Удалить"}
    </button>
  );
}
