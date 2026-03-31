"use client";

import { useState } from "react";
import { upsertMedicalProfile } from "./actions";

interface MedicalProfileData {
  blood_type: string | null;
  rh_factor: string | null;
  allergies: { name: string; reaction: string; severity: string }[];
  chronic_conditions: string[];
  emergency_info: string | null;
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
  baseline_weight_kg: number | null;
  family_risk_categories: string[];
  smoking_status: string;
  alcohol_status: string;
  functional_baseline: string | null;
  diagnoses: string[];
  operations_hospitalizations: string[];
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
  const [sex, setSex] = useState(initialData?.sex ?? "");
  const [birthDate, setBirthDate] = useState(initialData?.birth_date ?? "");
  const [heightCm, setHeightCm] = useState(initialData?.height_cm?.toString() ?? "");
  const [baselineWeight, setBaselineWeight] = useState(initialData?.baseline_weight_kg?.toString() ?? "");
  const [familyRisk, setFamilyRisk] = useState((initialData?.family_risk_categories ?? []).join(", "));
  const [smokingStatus, setSmokingStatus] = useState(initialData?.smoking_status ?? "unknown");
  const [alcoholStatus, setAlcoholStatus] = useState(initialData?.alcohol_status ?? "unknown");
  const [functionalBaseline, setFunctionalBaseline] = useState(initialData?.functional_baseline ?? "");
  const [diagnoses, setDiagnoses] = useState((initialData?.diagnoses ?? []).join("\n"));
  const [opsHosp, setOpsHosp] = useState((initialData?.operations_hospitalizations ?? []).join("\n"));
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
    formData.set("sex", sex);
    formData.set("birth_date", birthDate);
    formData.set("height_cm", heightCm);
    formData.set("baseline_weight_kg", baselineWeight);
    formData.set("family_risk_categories", familyRisk);
    formData.set("smoking_status", smokingStatus);
    formData.set("alcohol_status", alcoholStatus);
    formData.set("functional_baseline", functionalBaseline);
    formData.set("diagnoses", diagnoses);
    formData.set("operations_hospitalizations", opsHosp);

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

  const labelClass = "block text-sm font-medium mb-1";
  const labelStyle = { color: "var(--text-muted)" } as const;
  const inputClass = "w-full rounded-xl px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent-muted focus:border-accent";
  const inputStyle = { backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" } as const;

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6 max-w-2xl">
      {/* Группа крови + Резус */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>Группа крови</label>
          <select
            value={bloodType}
            onChange={(e) => setBloodType(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            {BLOOD_TYPES.map((bt) => (
              <option key={bt} value={bt}>
                {bt || "— не указана —"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Резус-фактор</label>
          <select
            value={rhFactor}
            onChange={(e) => setRhFactor(e.target.value)}
            className={inputClass}
            style={inputStyle}
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
        <label className={labelClass} style={labelStyle}>Аллергии</label>
        {allergies.map((allergy, i) => (
          <div key={i} className="mb-2 flex gap-2 items-start">
            <input
              placeholder="Аллерген"
              value={allergy.name}
              onChange={(e) => updateAllergy(i, "name", e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
            <input
              placeholder="Реакция"
              value={allergy.reaction}
              onChange={(e) => updateAllergy(i, "reaction", e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
            <select
              value={allergy.severity}
              onChange={(e) => updateAllergy(i, "severity", e.target.value)}
              className="rounded-xl px-3 py-2 text-sm transition-all focus:outline-none"
              style={{ backgroundColor: "var(--bg-surface-hover)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              <option value="low">Лёгкая</option>
              <option value="medium">Средняя</option>
              <option value="high">Тяжёлая</option>
            </select>
            <button
              type="button"
              onClick={() => removeAllergy(i)}
              className="shrink-0 text-sm px-2 py-2"
              style={{ color: "var(--amber)" }}
            >
              Удалить
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addAllergy}
          className="text-sm text-accent hover:brightness-90"
        >
          + Добавить аллергию
        </button>
      </div>

      {/* Хронические состояния */}
      <div>
        <label className={labelClass} style={labelStyle}>Хронические состояния</label>
        {chronic.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {chronic.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                style={{ backgroundColor: "var(--bg-surface-hover)", color: "var(--text-muted)" }}
              >
                {c}
                <button
                  type="button"
                  onClick={() => removeChronic(i)}
                  style={{ color: "var(--text-muted)" }}
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
            style={inputStyle}
          />
          <button
            type="button"
            onClick={addChronic}
            className="shrink-0 rounded-xl px-3 py-2 text-sm transition-all hover:brightness-110"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            Добавить
          </button>
        </div>
      </div>

      {/* ── Baseline ── */}
      <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Базовый профиль</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <div>
            <label className={labelClass} style={labelStyle}>Пол</label>
            <select value={sex} onChange={(e) => setSex(e.target.value)} className={inputClass} style={inputStyle}>
              <option value="">— не указан —</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
              <option value="other">Другой</option>
            </select>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Дата рождения</label>
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} style={inputStyle} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 mt-3">
          <div>
            <label className={labelClass} style={labelStyle}>Рост (см)</label>
            <input type="number" min={50} max={250} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="170" className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Базовый вес (кг)</label>
            <input type="number" min={20} max={300} step={0.1} value={baselineWeight} onChange={(e) => setBaselineWeight(e.target.value)} placeholder="70" className={inputClass} style={inputStyle} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 mt-3">
          <div>
            <label className={labelClass} style={labelStyle}>Курение</label>
            <select value={smokingStatus} onChange={(e) => setSmokingStatus(e.target.value)} className={inputClass} style={inputStyle}>
              <option value="unknown">— не указано —</option>
              <option value="never">Никогда</option>
              <option value="former">В прошлом</option>
              <option value="current">Курю</option>
            </select>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Алкоголь</label>
            <select value={alcoholStatus} onChange={(e) => setAlcoholStatus(e.target.value)} className={inputClass} style={inputStyle}>
              <option value="unknown">— не указано —</option>
              <option value="none">Не употребляю</option>
              <option value="moderate">Умеренно</option>
              <option value="heavy">Часто</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className={labelClass} style={labelStyle}>Семейные факторы риска</label>
          <input
            value={familyRisk}
            onChange={(e) => setFamilyRisk(e.target.value)}
            placeholder="Диабет, гипертония, онкология... (через запятую)"
            className={inputClass}
            style={inputStyle}
          />
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>Перечислите через запятую</p>
        </div>

        <div className="mt-3">
          <label className={labelClass} style={labelStyle}>Функциональный базовый уровень</label>
          <textarea
            value={functionalBaseline}
            onChange={(e) => setFunctionalBaseline(e.target.value)}
            rows={2}
            placeholder="Активность, подвижность, самостоятельность..."
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div className="mt-3">
          <label className={labelClass} style={labelStyle}>Диагнозы</label>
          <textarea
            value={diagnoses}
            onChange={(e) => setDiagnoses(e.target.value)}
            rows={3}
            placeholder={"Гипертония\nСахарный диабет 2 типа\nАстма"}
            className={inputClass}
            style={inputStyle}
          />
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>По одному на строку</p>
        </div>

        <div className="mt-3">
          <label className={labelClass} style={labelStyle}>Операции и госпитализации</label>
          <textarea
            value={opsHosp}
            onChange={(e) => setOpsHosp(e.target.value)}
            rows={3}
            placeholder={"Аппендэктомия, 2018\nГоспитализация пневмония, 2021"}
            className={inputClass}
            style={inputStyle}
          />
          <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)", opacity: 0.5 }}>По одному на строку</p>
        </div>
      </div>

      {/* Экстренная информация */}
      <div>
        <label className={labelClass} style={labelStyle}>Экстренная информация</label>
        <textarea
          value={emergencyInfo}
          onChange={(e) => setEmergencyInfo(e.target.value)}
          rows={3}
          placeholder="Контакты, важные замечания для экстренных служб..."
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium hover:brightness-90 disabled:opacity-50"
          style={{ color: "var(--bg-primary)" }}
        >
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
        {saved && <span className="text-sm text-accent">Сохранено</span>}
        {error && <span className="text-sm" style={{ color: "var(--amber)" }}>{error}</span>}
      </div>
    </form>
  );
}
