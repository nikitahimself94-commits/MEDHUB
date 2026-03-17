"use client";

import { useState } from "react";
import { upsertMedicalProfile } from "./actions";

interface MedicalProfileData {
  blood_type: string | null;
  rh_factor: string | null;
  allergies: { name: string; reaction: string; severity: string }[];
  chronic_conditions: string[];
  emergency_info: string | null;
}

const BLOOD_TYPES = ["", "I (O)", "II (A)", "III (B)", "IV (AB)"];
const RH_OPTIONS = ["", "+", "−"];

export function MedicalProfileForm({
  initialData,
}: {
  initialData: MedicalProfileData | null;
}) {
  const [bloodType, setBloodType] = useState(initialData?.blood_type ?? "");
  const [rhFactor, setRhFactor] = useState(initialData?.rh_factor ?? "");
  const [allergies, setAllergies] = useState<{ name: string; reaction: string; severity: string }[]>(
    initialData?.allergies ?? []
  );
  const [chronic, setChronic] = useState<string[]>(initialData?.chronic_conditions ?? []);
  const [newChronic, setNewChronic] = useState("");
  const [emergencyInfo, setEmergencyInfo] = useState(initialData?.emergency_info ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function addAllergy() {
    setAllergies([...allergies, { name: "", reaction: "", severity: "low" }]);
  }

  function removeAllergy(index: number) {
    setAllergies(allergies.filter((_, i) => i !== index));
  }

  function updateAllergy(index: number, field: string, value: string) {
    const updated = [...allergies];
    updated[index] = { ...updated[index], [field]: value };
    setAllergies(updated);
  }

  function addChronic() {
    const val = newChronic.trim();
    if (val && !chronic.includes(val)) {
      setChronic([...chronic, val]);
      setNewChronic("");
    }
  }

  function removeChronic(index: number) {
    setChronic(chronic.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");

    const formData = new FormData();
    formData.set("blood_type", bloodType);
    formData.set("rh_factor", rhFactor);
    formData.set("allergies", JSON.stringify(allergies.filter((a) => a.name.trim())));
    formData.set("chronic_conditions", JSON.stringify(chronic));
    formData.set("emergency_info", emergencyInfo);

    try {
      await upsertMedicalProfile(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const inputClass = "w-full rounded-xl border border-gray-200 bg-white/60 px-4 py-2.5 text-sm transition-all focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/10";

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6 max-w-2xl">
      {/* Группа крови + Резус */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <label className={labelClass}>Группа крови</label>
          <select
            value={bloodType}
            onChange={(e) => setBloodType(e.target.value)}
            className={inputClass}
          >
            {BLOOD_TYPES.map((bt) => (
              <option key={bt} value={bt}>
                {bt || "— не указана —"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Резус-фактор</label>
          <select
            value={rhFactor}
            onChange={(e) => setRhFactor(e.target.value)}
            className={inputClass}
          >
            {RH_OPTIONS.map((rh) => (
              <option key={rh} value={rh}>
                {rh || "— не указан —"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Аллергии */}
      <div>
        <label className={labelClass}>Аллергии</label>
        {allergies.map((allergy, i) => (
          <div key={i} className="mb-2 flex gap-2 items-start">
            <input
              placeholder="Аллерген"
              value={allergy.name}
              onChange={(e) => updateAllergy(i, "name", e.target.value)}
              className={inputClass}
            />
            <input
              placeholder="Реакция"
              value={allergy.reaction}
              onChange={(e) => updateAllergy(i, "reaction", e.target.value)}
              className={inputClass}
            />
            <select
              value={allergy.severity}
              onChange={(e) => updateAllergy(i, "severity", e.target.value)}
              className="rounded-xl border border-gray-200 bg-white/60 px-3 py-2 text-sm transition-all focus:border-brand-600 focus:bg-white focus:outline-none"
            >
              <option value="low">Лёгкая</option>
              <option value="medium">Средняя</option>
              <option value="high">Тяжёлая</option>
            </select>
            <button
              type="button"
              onClick={() => removeAllergy(i)}
              className="shrink-0 text-red-500 hover:text-red-700 text-sm px-2 py-2"
            >
              Удалить
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addAllergy}
          className="text-sm text-brand-600 hover:text-brand-800"
        >
          + Добавить аллергию
        </button>
      </div>

      {/* Хронические состояния */}
      <div>
        <label className={labelClass}>Хронические состояния</label>
        {chronic.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {chronic.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
              >
                {c}
                <button
                  type="button"
                  onClick={() => removeChronic(i)}
                  className="text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            placeholder="Добавить состояние"
            value={newChronic}
            onChange={(e) => setNewChronic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addChronic();
              }
            }}
            className={inputClass}
          />
          <button
            type="button"
            onClick={addChronic}
            className="shrink-0 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 transition-all hover:bg-white/80"
          >
            Добавить
          </button>
        </div>
      </div>

      {/* Экстренная информация */}
      <div>
        <label className={labelClass}>Экстренная информация</label>
        <textarea
          value={emergencyInfo}
          onChange={(e) => setEmergencyInfo(e.target.value)}
          rows={3}
          placeholder="Контакты, важные замечания для экстренных служб..."
          className={inputClass}
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
        {saved && <span className="text-sm text-teal-600">Сохранено</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
