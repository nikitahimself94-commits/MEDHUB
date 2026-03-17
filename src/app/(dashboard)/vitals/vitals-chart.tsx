"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const VITAL_TYPES = [
  { value: "blood_pressure", label: "Давление" },
  { value: "pulse", label: "Пульс" },
  { value: "temperature", label: "Температура" },
  { value: "spo2", label: "SpO2" },
  { value: "weight", label: "Вес" },
  { value: "glucose", label: "Глюкоза" },
] as const;

interface VitalPoint {
  vital_type: string;
  value: string;
  unit: string;
  measured_at: string;
}

interface ChartPoint {
  date: string;
  timestamp: number;
  value?: number;
  systolic?: number;
  diastolic?: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function prepareData(vitals: VitalPoint[], type: string): ChartPoint[] {
  const filtered = vitals
    .filter((v) => v.vital_type === type)
    .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());

  if (type === "blood_pressure") {
    return filtered.map((v) => {
      const parts = v.value.split("/");
      return {
        date: formatDate(v.measured_at),
        timestamp: new Date(v.measured_at).getTime(),
        systolic: parts[0] ? parseFloat(parts[0]) : undefined,
        diastolic: parts[1] ? parseFloat(parts[1]) : undefined,
      };
    });
  }

  return filtered.map((v) => ({
    date: formatDate(v.measured_at),
    timestamp: new Date(v.measured_at).getTime(),
    value: parseFloat(v.value) || 0,
  }));
}

function getUnit(vitals: VitalPoint[], type: string): string {
  const found = vitals.find((v) => v.vital_type === type);
  return found?.unit ?? "";
}

export function VitalsChart({ vitals }: { vitals: VitalPoint[] }) {
  const [selectedType, setSelectedType] = useState<string>(VITAL_TYPES[0].value);

  const data = prepareData(vitals, selectedType);
  const unit = getUnit(vitals, selectedType);
  const label = VITAL_TYPES.find((t) => t.value === selectedType)?.label ?? selectedType;
  const isBP = selectedType === "blood_pressure";

  return (
    <div className="rounded border bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {VITAL_TYPES.map((t) => {
          const hasData = vitals.some((v) => v.vital_type === t.value);
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setSelectedType(t.value)}
              className={`rounded px-3 py-1.5 text-sm ${
                selectedType === t.value
                  ? "bg-brand-600 font-medium text-white"
                  : hasData
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-gray-50 text-gray-400"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {data.length === 0 && (
        <p className="py-8 text-center text-sm text-gray-400">
          Нет данных по типу «{label}»
        </p>
      )}

      {data.length === 1 && (
        <p className="py-8 text-center text-sm text-gray-500">
          {label}: {isBP ? `${data[0].systolic}/${data[0].diastolic}` : data[0].value} {unit}
          <br />
          <span className="text-gray-400">Для графика нужно минимум 2 записи</span>
        </p>
      )}

      {data.length >= 2 && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              unit={unit ? ` ${unit}` : ""}
              width={70}
            />
            <Tooltip
              labelFormatter={(_label, payload) => {
                if (payload?.[0]?.payload?.timestamp) {
                  return formatDateTime(
                    new Date(payload[0].payload.timestamp).toISOString()
                  );
                }
                return _label;
              }}
              formatter={(val, name) => {
                const names: Record<string, string> = {
                  value: label,
                  systolic: "Систолическое",
                  diastolic: "Диастолическое",
                };
                return [String(val) + (unit ? ` ${unit}` : ""), names[String(name)] ?? String(name)];
              }}
            />
            {isBP ? (
              <>
                <Legend
                  formatter={(val) =>
                    val === "systolic" ? "Систолическое" : "Диастолическое"
                  }
                />
                <Line
                  type="monotone"
                  dataKey="systolic"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="diastolic"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              </>
            ) : (
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
