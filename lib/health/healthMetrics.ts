import type { HealthSectionTab } from "@/lib/health/healthSections";
import type { HealthMetricType } from "@/types";

export type HealthMetricDef = {
  type: HealthMetricType;
  label: string;
  defaultUnit: string;
  units: string[];
  tab: HealthSectionTab;
  step?: number;
  placeholder?: string;
};

export const HEALTH_METRICS: HealthMetricDef[] = [
  { type: "weight", label: "Weight", defaultUnit: "lb", units: ["lb", "kg"], tab: "weight", step: 0.1, placeholder: "185.5" },
  { type: "body_fat", label: "Body fat", defaultUnit: "%", units: ["%"], tab: "body", step: 0.1, placeholder: "18.5" },
  { type: "muscle_mass", label: "Muscle mass", defaultUnit: "lb", units: ["lb", "kg"], tab: "body", step: 0.1, placeholder: "75" },
  { type: "waist", label: "Waist", defaultUnit: "in", units: ["in", "cm"], tab: "body", step: 0.1, placeholder: "32" },
  {
    type: "blood_pressure_systolic",
    label: "Blood pressure",
    defaultUnit: "mmHg",
    units: ["mmHg"],
    tab: "vitals",
    step: 1,
    placeholder: "120",
  },
  { type: "resting_hr", label: "Resting HR", defaultUnit: "bpm", units: ["bpm"], tab: "vitals", step: 1, placeholder: "62" },
  { type: "sleep_hours", label: "Sleep", defaultUnit: "hrs", units: ["hrs"], tab: "vitals", step: 0.25, placeholder: "7.5" },
  { type: "steps", label: "Steps", defaultUnit: "count", units: ["count"], tab: "activity", step: 1, placeholder: "8500" },
  { type: "active_minutes", label: "Active minutes", defaultUnit: "min", units: ["min"], tab: "activity", step: 1, placeholder: "45" },
  { type: "calories_burned", label: "Calories burned", defaultUnit: "kcal", units: ["kcal"], tab: "activity", step: 1, placeholder: "450" },
  { type: "stress", label: "Stress", defaultUnit: "score", units: ["score"], tab: "stress", step: 1, placeholder: "5" },
];

export function getHealthMetricDef(type: HealthMetricType): HealthMetricDef {
  return HEALTH_METRICS.find((m) => m.type === type) ?? HEALTH_METRICS[0];
}

export function getMetricsForTab(tab: HealthSectionTab): HealthMetricDef[] {
  return HEALTH_METRICS.filter((m) => m.tab === tab);
}

export function formatHealthValue(value: number, unit: string): string {
  if (unit === "count") return Math.round(value).toLocaleString();
  if (unit === "score") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  if (unit === "%" || unit === "hrs") return `${value.toFixed(1)}${unit === "%" ? "%" : " hrs"}`;
  if (unit === "mmHg" || unit === "bpm" || unit === "min" || unit === "kcal") {
    return `${Math.round(value)} ${unit}`;
  }
  return `${value.toFixed(1)} ${unit}`;
}