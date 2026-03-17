"use client";

import { useState } from "react";
import { createDocument } from "./actions";

const CATEGORIES = [
  "",
  "Анализ крови",
  "УЗИ",
  "МРТ",
  "КТ",
  "Рентген",
  "ЭКГ",
  "Консультация",
  "Выписка",
  "Рецепт",
  "Другое",
];

const STATUSES = [
  { value: "normal", label: "Норма" },
  { value: "review", label: "Требует внимания" },
  { value: "abnormal", label: "Отклонение" },
];

export function DocumentForm() {
  const [open, setOpen] = useState(false);
  const [documentDate, setDocumentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [doctor, setDoctor] = useState("");
  const [lab, setLab] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("normal");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Название обязательно");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");

    const formData = new FormData();
    formData.set("document_date", documentDate);
    formData.set("category", category);
    formData.set("title", title);
    formData.set("doctor", doctor);
    formData.set("lab", lab);
    if (file) {
      formData.set("file", file);
    }
    formData.set("status", status);
    formData.set("tags", tags);
    formData.set("notes", notes);

    try {
      await createDocument(formData);
      setSaved(true);
      setTitle("");
      setDoctor("");
      setLab("");
      setFile(null);
      setStatus("normal");
      setCategory("");
      setDocumentDate(new Date().toISOString().slice(0, 10));
      setTags("");
      setNotes("");
      setOpen(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white/60 px-4 py-2.5 text-sm transition-all focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/10";

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => { setSaved(false); setError(""); setOpen(true); }}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Добавить документ
        </button>
        {saved && <span className="text-sm text-teal-600">Сохранено</span>}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Новый документ</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Отмена
        </button>
      </div>

      <div className="rounded bg-brand-50/60 px-4 py-3 text-sm text-brand-800">
        <p className="font-medium">Загрузите документ как есть — мы примем любой формат.</p>
        <p className="mt-1 text-xs text-brand-700">
          Чтобы AI-разбор работал точнее, по возможности:
          сфотографируйте при хорошем свете · без бликов и теней · лист целиком, без обрезки · один документ = один файл
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <label className={labelClass}>Дата документа</label>
          <input
            type="date"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Категория</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c || "— не выбрана —"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Название *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Общий анализ крови"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <label className={labelClass}>Врач</label>
          <input
            value={doctor}
            onChange={(e) => setDoctor(e.target.value)}
            placeholder="Иванов А.П."
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Лаборатория / Клиника</label>
          <input
            value={lab}
            onChange={(e) => setLab(e.target.value)}
            placeholder="Инвитро"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <label className={labelClass}>Статус</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Файл</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:text-gray-700 hover:file:bg-gray-200"
          />
          {file && (
            <p className="mt-1 text-xs text-gray-500">{file.name} ({(file.size / 1024).toFixed(0)} КБ)</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            PDF, фото или скриншот — загрузите как есть
          </p>
        </div>
      </div>

      <div>
        <label className={labelClass}>Теги (через запятую)</label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="онкология, контроль, ежемесячный"
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Заметка</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Комментарий к документу..."
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить документ"}
        </button>
        {saved && <span className="text-sm text-teal-600">Сохранено</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
