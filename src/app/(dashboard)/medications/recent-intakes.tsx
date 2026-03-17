"use client";

import { useState } from "react";

interface RecentIntake {
  taken_at: string;
  display_name: string;
}

export function RecentIntakes({ intakes }: { intakes: RecentIntake[] }) {
  const [open, setOpen] = useState(false);

  if (intakes.length === 0) {
    return (
      <p className="mt-3 border-t pt-2 text-xs text-gray-400">
        Отметок пока нет
      </p>
    );
  }

  return (
    <div className="mt-3 border-t pt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">
          Последние отметки ({intakes.length})
        </p>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-brand-600 hover:text-brand-800"
        >
          {open ? "Скрыть" : "Показать"}
        </button>
      </div>
      {open && (
        <ul className="mt-1 space-y-0.5">
          {intakes.map((intake, i) => (
            <li key={i} className="text-xs text-gray-600">
              {new Date(intake.taken_at).toLocaleTimeString("ru-RU", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              — {intake.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
