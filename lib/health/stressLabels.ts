export const STRESS_MIN = 1;
export const STRESS_MAX = 10;
export const STRESS_ROLLING_WINDOW_DAYS = 7;

export const STRESS_RANGE_OPTIONS = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
] as const;

export type StressDriverId =
  | "work"
  | "family"
  | "money"
  | "health"
  | "sleep"
  | "people"
  | "news"
  | "other";

export const STRESS_DRIVERS: Array<{ id: StressDriverId; label: string }> = [
  { id: "work", label: "Work" },
  { id: "family", label: "Family" },
  { id: "money", label: "Money" },
  { id: "health", label: "Health" },
  { id: "sleep", label: "Sleep" },
  { id: "people", label: "People" },
  { id: "news", label: "News" },
  { id: "other", label: "Other" },
];

export type StressBand = {
  id: "calm" | "steady" | "elevated" | "stressed" | "overwhelmed";
  label: string;
  min: number;
  max: number;
  color: string;
};

export const STRESS_BANDS: StressBand[] = [
  { id: "calm", label: "Calm", min: 1, max: 2, color: "#2dd4bf" },
  { id: "steady", label: "Steady", min: 3, max: 4, color: "#38bdf8" },
  { id: "elevated", label: "Elevated", min: 5, max: 6, color: "#fbbf24" },
  { id: "stressed", label: "Stressed", min: 7, max: 8, color: "#fb923c" },
  { id: "overwhelmed", label: "Overwhelmed", min: 9, max: 10, color: "#fb7185" },
];

export function clampStressScore(value: number): number {
  if (!Number.isFinite(value)) return STRESS_MIN;
  return Math.min(STRESS_MAX, Math.max(STRESS_MIN, Math.round(value)));
}

export function getStressBand(score: number): StressBand {
  const clamped = clampStressScore(score);
  return STRESS_BANDS.find((b) => clamped >= b.min && clamped <= b.max) ?? STRESS_BANDS[2];
}

export function getStressDriverLabel(id: string): string {
  return STRESS_DRIVERS.find((d) => d.id === id)?.label ?? id;
}

export function parseStressDrivers(metadata: Record<string, unknown> | undefined | null): StressDriverId[] {
  const raw = metadata?.drivers;
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(STRESS_DRIVERS.map((d) => d.id));
  return raw.filter((id): id is StressDriverId => typeof id === "string" && allowed.has(id));
}
